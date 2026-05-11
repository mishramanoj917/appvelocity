import type { IRElement, IRScreen, IRTokenSet } from '@appvelocity/agent-design-to-code-core';

export type FlutterStateManagement = 'riverpod' | 'bloc' | 'provider' | 'none';

// ─── Version constants (update here only) ────────────────────────────────────
// Verified against pub.dev, May 2026. Latest stable Flutter SDK: 3.41.5.
const FLUTTER_VERSIONS = {
  sdkConstraint:        '>=3.27.0 <4.0.0',
  flutterConstraint:    '>=3.27.0',
  cupertino_icons:      '^1.0.9',
  go_router:            '^16.2.0',
  cached_network_image: '^3.4.1',
  flutter_lints:        '^6.0.0',
  flutter_riverpod:     '^3.3.1',
  riverpod_annotation:  '^4.0.2',
  flutter_bloc:         '^9.1.1',
  bloc:                 '^9.2.0',
  provider:             '^6.1.5',
} as const;

// ─── Widget mapping ────────────────────────────────────────────────────────────

const NAME_TO_WIDGET: [RegExp, string][] = [
  [/button|btn|cta/i, 'ElevatedButton'],
  [/textbutton|link.?btn/i, 'TextButton'],
  [/outlinedbutton|outline.?btn/i, 'OutlinedButton'],
  [/input|textfield|search|field/i, 'TextField'],
  [/checkbox/i, 'Checkbox'],
  [/switch|toggle/i, 'Switch'],
  [/radio/i, 'Radio'],
  [/slider/i, 'Slider'],
  [/chip/i, 'Chip'],
  [/avatar|profile.?pic/i, 'CircleAvatar'],
  [/divider|separator/i, 'Divider'],
  [/progress|loader|spinner/i, 'CircularProgressIndicator'],
  [/list|feed|scroll/i, 'ListView'],
  [/card/i, 'Card'],
  [/appbar|navbar|header/i, 'AppBar'],
  [/bottombar|tabbar|bottomnav/i, 'BottomNavigationBar'],
  [/drawer/i, 'Drawer'],
  [/fab|floatingbutton/i, 'FloatingActionButton'],
  [/snackbar|toast/i, 'SnackBar'],
  [/dialog|modal|alert/i, 'AlertDialog'],
  [/image|photo|banner|hero/i, 'Image.network'],
  [/icon/i, 'Icon'],
  [/text|label|heading|title|subtitle|caption/i, 'Text'],
  [/row/i, 'Row'],
  [/column|col/i, 'Column'],
  [/stack/i, 'Stack'],
  [/wrap/i, 'Wrap'],
  [/spacer|gap/i, 'SizedBox'],
  [/padding/i, 'Padding'],
  [/container|box|frame|group/i, 'Container'],
];

// ─── FlutterSkills ────────────────────────────────────────────────────────────

export class FlutterSkills {

  widgetForElement(el: IRElement): string {
    // Type-based overrides take priority
    switch (el.type) {
      case 'text':             return 'Text';
      case 'image':            return 'Image.network';
      case 'imagebackground':  return 'Container'; // with DecorationImage
      case 'icon':             return 'Icon';
      case 'scrollview':       return 'SingleChildScrollView';
      case 'flatlist':         return 'ListView.builder';
      case 'touchable':        return 'GestureDetector';
      case 'input':            return 'TextField';
      case 'component-instance': return 'Container'; // placeholder; replaced by generator
    }

    // Name heuristics for 'view' type
    for (const [re, widget] of NAME_TO_WIDGET) {
      if (re.test(el.name)) return widget;
    }

    // Layout direction heuristic
    const dir = el.layout?.flex?.direction;
    if (dir === 'row') return 'Row';
    if (dir === 'column') return 'Column';

    return 'Container';
  }

  // ─── Project file generators ───────────────────────────────────────────────

  generateMain(screens: IRScreen[], stateManagement: FlutterStateManagement): string {
    const hasRouter = screens.length > 1;
    const wrapOpen = this._stateWrapOpen(stateManagement);
    const wrapClose = this._stateWrapClose(stateManagement);
    const imports = this._stateImports(stateManagement);
    const routerImport = hasRouter ? "import 'package:go_router/go_router.dart';\n" : '';
    const routerRef = hasRouter ? "import 'router.dart';" : '';

    return `import 'package:flutter/material.dart';
${imports}${routerImport}import 'app.dart';
${routerRef}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  ${wrapOpen}runApp(const MyApp());${wrapClose}
}
`;
  }

  generateApp(screens: IRScreen[]): string {
    const hasMultipleScreens = screens.length > 1;
    const routerField = hasMultipleScreens
      ? `\n  final _router = appRouter;\n`
      : '';
    const homeOrRouter = hasMultipleScreens
      ? `routerConfig: _router,`
      : `home: ${screens[0]?.componentName ?? 'Scaffold'}(),`;

    return `import 'package:flutter/material.dart';
${hasMultipleScreens ? "import 'router.dart';\n" : ''}import 'theme.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});
${routerField}
  @override
  Widget build(BuildContext context) {
    return MaterialApp${hasMultipleScreens ? '.router' : ''}(
      title: 'App',
      theme: appTheme,
      debugShowCheckedModeBanner: false,
      ${homeOrRouter}
    );
  }
}
`;
  }

  generateRouter(screens: IRScreen[]): string {
    const routes = screens
      .map((s, i) => {
        const path = i === 0 ? '/' : `/${this._toKebab(s.name)}`;
        return `  GoRoute(
    path: '${path}',
    name: '${this._toKebab(s.name)}',
    builder: (context, state) => const ${s.componentName}(),
  ),`;
      })
      .join('\n');

    const imports = screens
      .map((s) => `import 'screens/${this._toSnake(s.name)}.dart';`)
      .join('\n');

    return `import 'package:go_router/go_router.dart';
${imports}

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
${routes}
  ],
);
`;
  }

  generateTheme(tokens: IRTokenSet): string {
    const primary = Object.values(tokens.colors).find((c) =>
      /primary/i.test(c.path)
    )?.hex ?? '#6750A4';
    const background = Object.values(tokens.colors).find((c) =>
      /background|bg/i.test(c.path)
    )?.hex ?? '#FFFFFF';

    const baseFont = Object.values(tokens.typography)[0]?.fontFamily ?? 'Roboto';

    return `import 'package:flutter/material.dart';

final appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF${primary.replace('#', '')}),
    background: const Color(0xFF${background.replace('#', '')}),
  ),
  fontFamily: '${baseFont}',
);
`;
  }

  generatePubspec(projectName: string, stateManagement: FlutterStateManagement, hasFonts = false): string {
    const smDeps = this._pubspecStateDeps(stateManagement);
    const fontSection = hasFonts
      ? `\n  fonts:\n    # Add font assets here\n`
      : '';

    return `name: ${this._toSnake(projectName)}
description: Generated by AppVelocity Design-to-Code
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '${FLUTTER_VERSIONS.sdkConstraint}'
  flutter: '${FLUTTER_VERSIONS.flutterConstraint}'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ${FLUTTER_VERSIONS.cupertino_icons}
  go_router: ${FLUTTER_VERSIONS.go_router}
  cached_network_image: ${FLUTTER_VERSIONS.cached_network_image}
${smDeps}
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ${FLUTTER_VERSIONS.flutter_lints}

flutter:
  uses-material-design: true
${fontSection}`;
  }

  generateStateFiles(screens: IRScreen[], stateManagement: FlutterStateManagement): Map<string, string> {
    const files = new Map<string, string>();

    if (stateManagement === 'none') return files;

    for (const screen of screens) {
      const snake = this._toSnake(screen.name);
      const pascal = screen.componentName;

      if (stateManagement === 'riverpod') {
        files.set(`lib/state/${snake}_provider.dart`, this._riverpodProvider(pascal));
      } else if (stateManagement === 'bloc') {
        files.set(`lib/state/${snake}/event.dart`, this._blocEvent(pascal));
        files.set(`lib/state/${snake}/state.dart`, this._blocState(pascal));
        files.set(`lib/state/${snake}/bloc.dart`, this._blocClass(pascal));
      } else if (stateManagement === 'provider') {
        files.set(`lib/state/${snake}_notifier.dart`, this._providerNotifier(pascal));
      }
    }

    return files;
  }

  generateAnalysisOptions(): string {
    return `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    avoid_print: true
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
`;
  }

  generateGitignore(): string {
    return `.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/
*.iml
*.class
*.log
*.pyc
*.swp
.DS_Store
.atom/
.buildlog/
.history
.svn/
`;
  }

  getDependencies(stateManagement: FlutterStateManagement): Record<string, string> {
    const base: Record<string, string> = {
      flutter:              'sdk: flutter',
      cupertino_icons:      FLUTTER_VERSIONS.cupertino_icons,
      go_router:            FLUTTER_VERSIONS.go_router,
      cached_network_image: FLUTTER_VERSIONS.cached_network_image,
    };
    return { ...base, ...this._stateDepsMap(stateManagement) };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _toSnake(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .replace(/[\s\-]+/g, '_')
      .replace(/^_/, '')
      .toLowerCase();
  }

  private _toKebab(name: string): string {
    return this._toSnake(name).replace(/_/g, '-');
  }

  private _stateImports(sm: FlutterStateManagement): string {
    if (sm === 'riverpod') return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n";
    if (sm === 'bloc') return "import 'package:flutter_bloc/flutter_bloc.dart';\n";
    if (sm === 'provider') return "import 'package:provider/provider.dart';\n";
    return '';
  }

  private _stateWrapOpen(sm: FlutterStateManagement): string {
    if (sm === 'riverpod') return 'runApp(\n    ProviderScope(\n      child: ';
    return '';
  }

  private _stateWrapClose(sm: FlutterStateManagement): string {
    if (sm === 'riverpod') return '\n    ),\n  );';
    return ';';
  }

  private _pubspecStateDeps(sm: FlutterStateManagement): string {
    if (sm === 'riverpod') return `  flutter_riverpod: ${FLUTTER_VERSIONS.flutter_riverpod}\n  riverpod_annotation: ${FLUTTER_VERSIONS.riverpod_annotation}\n`;
    if (sm === 'bloc')     return `  flutter_bloc: ${FLUTTER_VERSIONS.flutter_bloc}\n  bloc: ${FLUTTER_VERSIONS.bloc}\n`;
    if (sm === 'provider') return `  provider: ${FLUTTER_VERSIONS.provider}\n`;
    return '';
  }

  private _stateDepsMap(sm: FlutterStateManagement): Record<string, string> {
    if (sm === 'riverpod') return { flutter_riverpod: FLUTTER_VERSIONS.flutter_riverpod, riverpod_annotation: FLUTTER_VERSIONS.riverpod_annotation };
    if (sm === 'bloc')     return { flutter_bloc: FLUTTER_VERSIONS.flutter_bloc, bloc: FLUTTER_VERSIONS.bloc };
    if (sm === 'provider') return { provider: FLUTTER_VERSIONS.provider };
    return {};
  }

  private _riverpodProvider(pascal: string): string {
    const camel = `${pascal[0]!.toLowerCase()}${pascal.slice(1)}`;
    // Riverpod 3.x: StateNotifier/StateNotifierProvider moved to legacy.dart.
    // Use Notifier + NotifierProvider instead.
    return `import 'package:flutter_riverpod/flutter_riverpod.dart';

class ${pascal}State {
  const ${pascal}State();
  // Add your state fields here
}

class ${pascal}Notifier extends Notifier<${pascal}State> {
  @override
  ${pascal}State build() => const ${pascal}State();
  // Add your state mutation methods here
}

final ${camel}Provider =
    NotifierProvider<${pascal}Notifier, ${pascal}State>(
  ${pascal}Notifier.new,
);
`;
  }

  private _blocEvent(pascal: string): string {
    return `part of '${this._toSnake(pascal)}_bloc.dart';

abstract class ${pascal}Event {}

class ${pascal}Started extends ${pascal}Event {}
`;
  }

  private _blocState(pascal: string): string {
    return `part of '${this._toSnake(pascal)}_bloc.dart';

class ${pascal}State {
  const ${pascal}State();
}
`;
  }

  private _blocClass(pascal: string): string {
    const snake = this._toSnake(pascal);
    return `import 'package:flutter_bloc/flutter_bloc.dart';

part 'event.dart';
part 'state.dart';

class ${pascal}Bloc extends Bloc<${pascal}Event, ${pascal}State> {
  ${pascal}Bloc() : super(const ${pascal}State()) {
    on<${pascal}Started>(_onStarted);
  }

  Future<void> _onStarted(
    ${pascal}Started event,
    Emitter<${pascal}State> emit,
  ) async {
    // TODO: handle ${snake} started
  }
}
`;
  }

  private _providerNotifier(pascal: string): string {
    return `import 'package:flutter/foundation.dart';

class ${pascal}Notifier extends ChangeNotifier {
  // Add your state fields here

  // Call notifyListeners() after mutating state
}
`;
  }
}
