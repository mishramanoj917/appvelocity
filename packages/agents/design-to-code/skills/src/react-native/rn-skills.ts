import type { IRElement, IRScreen } from '@appvelocity/agent-design-to-code-core';

export type RNStateManagement = 'zustand' | 'redux' | 'jotai' | 'none';

// ─── Component mapping ─────────────────────────────────────────────────────────

const NAME_TO_COMPONENT: [RegExp, string][] = [
  [/button|btn|cta/i, 'TouchableOpacity'],
  [/textbutton|link.?btn/i, 'TouchableOpacity'],
  [/input|textfield|search|field/i, 'TextInput'],
  [/checkbox/i, 'View'], // react-native-checkbox or custom
  [/switch|toggle/i, 'Switch'],
  [/slider/i, 'View'], // react-native-slider or custom
  [/list|feed/i, 'FlatList'],
  [/scrollview|scroll/i, 'ScrollView'],
  [/image|photo|banner|hero/i, 'Image'],
  [/icon/i, 'Image'], // SVG icons via react-native-svg
  [/text|label|heading|title|subtitle|caption/i, 'Text'],
  [/row/i, 'View'], // with flexDirection:'row' style
  [/divider|separator/i, 'View'],
  [/card/i, 'View'],
  [/modal|dialog|alert/i, 'Modal'],
  [/container|box|frame|group|wrapper/i, 'View'],
];

// ─── ReactNativeSkills ────────────────────────────────────────────────────────

export class ReactNativeSkills {

  componentForElement(el: IRElement): string {
    switch (el.type) {
      case 'text':             return 'Text';
      case 'image':            return 'Image';
      case 'imagebackground':  return 'ImageBackground';
      case 'icon':             return 'Image';
      case 'scrollview':       return 'ScrollView';
      case 'flatlist':         return 'FlatList';
      case 'touchable':        return 'TouchableOpacity';
      case 'input':            return 'TextInput';
      case 'component-instance': return 'View';
    }

    for (const [re, component] of NAME_TO_COMPONENT) {
      if (re.test(el.name)) return component;
    }

    const dir = el.layout?.flex?.direction;
    if (dir === 'row') return 'View'; // with style={{ flexDirection:'row' }}

    return 'View';
  }

  // ─── Project file generators ───────────────────────────────────────────────

  generateApp(stateManagement: RNStateManagement): string {
    const storeImport = this._storeImport(stateManagement);
    const wrapOpen = this._storeWrapOpen(stateManagement);
    const wrapClose = this._storeWrapClose(stateManagement);

    return `import React from 'react';
${storeImport}import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    ${wrapOpen}<AppNavigator />${wrapClose}
  );
}
`;
  }

  generateNavigation(screens: IRScreen[]): string {
    // Deduplicate by componentName — Figma files with multiple pages can list
    // the same screen more than once, which would produce duplicate imports.
    const seen = new Set<string>();
    const unique = screens.filter((s) => {
      if (seen.has(s.componentName)) return false;
      seen.add(s.componentName);
      return true;
    });

    const screenImports = unique
      .map((s) => `import { ${s.componentName} } from '../screens/${s.componentName}';`)
      .join('\n');

    const screenDeclarations = unique
      .map((s) => `      <Stack.Screen name="${s.componentName}" component={${s.componentName}} />`)
      .join('\n');

    // Import RootStackParamList from types.ts — do NOT redefine it here because
    // code-generator already emits src/navigation/types.ts with that type, and
    // two definitions in the same project cause TypeScript conflicts.
    return `import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
${screenImports}

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="${unique[0]?.componentName ?? 'Screen'}"
        screenOptions={{ headerShown: false }}
      >
${screenDeclarations}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`;
  }

  generateStore(stateManagement: RNStateManagement): Map<string, string> {
    const files = new Map<string, string>();
    if (stateManagement === 'none') return files;

    if (stateManagement === 'zustand') {
      files.set('src/store/index.ts', this._zustandStore());
    } else if (stateManagement === 'redux') {
      files.set('src/store/store.ts', this._reduxStore());
      files.set('src/store/rootReducer.ts', this._reduxRootReducer());
    } else if (stateManagement === 'jotai') {
      files.set('src/store/atoms.ts', this._jotaiAtoms());
    }

    return files;
  }

  generatePackageJson(projectName: string, stateManagement: RNStateManagement): string {
    const smDeps = this._packageJsonStateDeps(stateManagement);
    const slug = projectName.toLowerCase().replace(/\s+/g, '-');

    return JSON.stringify({
      name: slug,
      version: '0.1.0',
      main: 'node_modules/expo/AppEntry.js',
      scripts: {
        start: 'expo start',
        android: 'expo start --android',
        ios: 'expo start --ios',
        web: 'expo start --web',
        'type-check': 'tsc --noEmit',
      },
      dependencies: {
        expo: '~51.0.0',
        'expo-status-bar': '~1.12.1',
        react: '18.2.0',
        'react-native': '0.74.1',
        '@react-navigation/native': '^6.1.17',
        '@react-navigation/native-stack': '^6.9.26',
        'react-native-safe-area-context': '4.10.1',
        'react-native-screens': '3.31.1',
        ...smDeps,
      },
      devDependencies: {
        '@babel/core': '^7.24.0',
        '@types/react': '~18.2.79',
        '@types/react-native': '^0.73.0',
        typescript: '^5.4.5',
      },
    }, null, 2);
  }

  generateTSConfig(): string {
    return JSON.stringify({
      extends: 'expo/tsconfig.base',
      compilerOptions: {
        strict: true,
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
    }, null, 2);
  }

  generateAppJson(projectName: string): string {
    const slug = projectName.toLowerCase().replace(/\s+/g, '-');
    return JSON.stringify({
      expo: {
        name: projectName,
        slug,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        splash: {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
        ios: { supportsTablet: true },
        android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ffffff' } },
        web: { favicon: './assets/favicon.png' },
      },
    }, null, 2);
  }

  generateBabelConfig(): string {
    return `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`;
  }

  generateGitignore(): string {
    return `node_modules/
.expo/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
.DS_Store
*.env
`;
  }

  getDependencies(stateManagement: RNStateManagement): Record<string, string> {
    return {
      expo: '~51.0.0',
      react: '18.2.0',
      'react-native': '0.74.1',
      '@react-navigation/native': '^6.1.17',
      '@react-navigation/native-stack': '^6.9.26',
      ...this._packageJsonStateDeps(stateManagement),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _storeImport(sm: RNStateManagement): string {
    if (sm === 'redux') return "import { Provider } from 'react-redux';\nimport { store } from './src/store/store';\n";
    return '';
  }

  private _storeWrapOpen(sm: RNStateManagement): string {
    if (sm === 'redux') return '<Provider store={store}>\n      ';
    return '';
  }

  private _storeWrapClose(sm: RNStateManagement): string {
    if (sm === 'redux') return '\n    </Provider>';
    return '';
  }

  private _packageJsonStateDeps(sm: RNStateManagement): Record<string, string> {
    if (sm === 'zustand') return { zustand: '^4.5.2' };
    if (sm === 'redux') return { '@reduxjs/toolkit': '^2.2.3', 'react-redux': '^9.1.2' };
    if (sm === 'jotai') return { jotai: '^2.8.0' };
    return {};
  }

  private _zustandStore(): string {
    return `import { create } from 'zustand';

interface AppState {
  // Add your global state here
}

export const useAppStore = create<AppState>(() => ({
  // Initial state
}));
`;
  }

  private _reduxStore(): string {
    return `import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './rootReducer';

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
`;
  }

  private _reduxRootReducer(): string {
    return `import { combineReducers } from '@reduxjs/toolkit';

export const rootReducer = combineReducers({
  // Add your slice reducers here
});
`;
  }

  private _jotaiAtoms(): string {
    return `import { atom } from 'jotai';

// Add your atoms here
export const exampleAtom = atom<string>('');
`;
  }
}
