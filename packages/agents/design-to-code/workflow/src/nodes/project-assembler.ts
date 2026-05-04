/**
 * Node 8 — ProjectAssemblerAgent
 *
 * Assembles a complete, runnable project by combining:
 *   - Screen/component files from codeGenerator (generatedCode)
 *   - Framework project scaffold from FlutterSkills / ReactNativeSkills:
 *       Flutter:       main.dart, app.dart, router.dart, theme.dart, pubspec.yaml,
 *                      state management files, analysis_options.yaml, .gitignore
 *       React Native:  App.tsx, AppNavigator.tsx, store files, package.json,
 *                      tsconfig.json, app.json, babel.config.js, .gitignore
 *
 * Only runs when generationMode === 'project'. In 'screens' mode the graph
 * skips this node and routes directly to codeValidator.
 *
 * Input state:  generatedCode, executionPlan, targetFramework, stateManagement, designIR
 * Output state: projectBundle, currentStep, logs
 */

import { FlutterSkills } from '@appvelocity/agent-design-to-code-skills';
import { ReactNativeSkills } from '@appvelocity/agent-design-to-code-skills';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState, ProjectBundle, ProjectFile } from '../types.js';
import type { IRScreen } from '@appvelocity/agent-design-to-code-core';

// ─── Flutter assembly ─────────────────────────────────────────────────────────

function assembleFlutter(state: WorkflowState, screens: IRScreen[]): ProjectBundle {
  const skills = new FlutterSkills();
  const sm = (state.stateManagement ?? 'none') as Parameters<typeof skills.generateMain>[1];
  const projectName = state.executionPlan?.projectName ?? 'MyApp';
  const tokens = state.designIR?.tokens;

  const files: ProjectFile[] = [];

  // Entry point
  files.push({ path: 'lib/main.dart', content: skills.generateMain(screens, sm), language: 'dart' });
  files.push({ path: 'lib/app.dart', content: skills.generateApp(screens), language: 'dart' });

  // Router (only when multiple screens)
  if (screens.length > 1) {
    files.push({ path: 'lib/router.dart', content: skills.generateRouter(screens), language: 'dart' });
  }

  // Theme
  if (tokens) {
    files.push({ path: 'lib/theme.dart', content: skills.generateTheme(tokens), language: 'dart' });
  }

  // State management files
  const stateFiles = skills.generateStateFiles(screens, sm);
  for (const [path, content] of stateFiles) {
    files.push({ path, content, language: 'dart' });
  }

  // Generated screen and component files from codeGenerator
  if (state.generatedCode) {
    for (const cf of state.generatedCode.files) {
      files.push({ path: cf.path, content: cf.content, language: 'dart' });
    }
  }

  // Config files
  const hasFonts = (state.visualAnalysis?.fontFamilies?.length ?? 0) > 0;
  const assetPaths = state.generatedCode?.assets?.map((a) => a.path) ?? [];
  const pubspecContent = injectFlutterAssets(
    skills.generatePubspec(projectName, sm, hasFonts),
    assetPaths
  );
  files.push({ path: 'pubspec.yaml', content: pubspecContent, language: 'yaml' });
  files.push({ path: 'analysis_options.yaml', content: skills.generateAnalysisOptions(), language: 'yaml' });
  files.push({ path: '.gitignore', content: skills.generateGitignore(), language: 'text' });
  files.push({ path: 'README.md', content: generateFlutterReadme(projectName), language: 'text' });

  return {
    projectName,
    framework: 'flutter',
    files,
    assets: state.generatedCode?.assets?.map((a) => ({ path: a.path, url: a.url })) ?? [],
    dependencies: skills.getDependencies(sm),
  };
}

// ─── React Native assembly ────────────────────────────────────────────────────

function assembleReactNative(state: WorkflowState, screens: IRScreen[]): ProjectBundle {
  const skills = new ReactNativeSkills();
  const sm = (state.stateManagement ?? 'none') as Parameters<typeof skills.generateApp>[0];
  const projectName = state.executionPlan?.projectName ?? 'MyApp';

  const files: ProjectFile[] = [];

  // Entry point
  files.push({ path: 'App.tsx', content: skills.generateApp(sm), language: 'typescript' });

  // Navigation
  files.push({ path: 'src/navigation/AppNavigator.tsx', content: skills.generateNavigation(screens), language: 'typescript' });

  // State management
  const storeFiles = skills.generateStore(sm);
  for (const [path, content] of storeFiles) {
    files.push({ path, content, language: 'typescript' });
  }

  // Generated screen and component files from codeGenerator
  if (state.generatedCode) {
    for (const cf of state.generatedCode.files) {
      files.push({ path: cf.path, content: cf.content, language: 'typescript' });
    }
  }

  // Config files
  files.push({ path: 'package.json', content: skills.generatePackageJson(projectName, sm), language: 'json' });
  files.push({ path: 'tsconfig.json', content: skills.generateTSConfig(), language: 'json' });
  files.push({ path: 'app.json', content: skills.generateAppJson(projectName), language: 'json' });
  files.push({ path: 'babel.config.js', content: skills.generateBabelConfig(), language: 'javascript' });
  files.push({ path: '.gitignore', content: skills.generateGitignore(), language: 'text' });
  files.push({ path: 'README.md', content: generateRNReadme(projectName), language: 'text' });

  return {
    projectName,
    framework: 'react-native',
    files,
    assets: state.generatedCode?.assets?.map((a) => ({ path: a.path, url: a.url })) ?? [],
    dependencies: skills.getDependencies(sm),
  };
}

// ─── README generators ────────────────────────────────────────────────────────

function generateFlutterReadme(projectName: string): string {
  return `# ${projectName}

Generated by [AppVelocity](https://appvelocity.ai) Design-to-Code agent.

## Getting Started

\`\`\`bash
flutter pub get
flutter run
\`\`\`

## Project Structure

\`\`\`
lib/
  main.dart          # Entry point
  app.dart           # MaterialApp + router config
  router.dart        # GoRouter navigation
  theme.dart         # App theme
  screens/           # Generated screens
  components/        # Reusable widgets
  state/             # State management
  tokens/            # Design tokens
\`\`\`
`;
}

function generateRNReadme(projectName: string): string {
  return `# ${projectName}

Generated by [AppVelocity](https://appvelocity.ai) Design-to-Code agent.

## Getting Started

\`\`\`bash
npm install
npx expo start
\`\`\`

## Project Structure

\`\`\`
App.tsx                        # Entry point
src/
  navigation/AppNavigator.tsx  # React Navigation stack
  screens/                     # Generated screens
  components/                  # Reusable components
  store/                       # State management
  tokens/                      # Design tokens
\`\`\`
`;
}

// ─── Flutter pubspec asset injection ─────────────────────────────────────────

function injectFlutterAssets(pubspec: string, assetPaths: string[]): string {
  if (assetPaths.length === 0) return pubspec;

  const dirs = new Set<string>();
  for (const p of assetPaths) {
    // e.g. "assets/images/hero.png" → "assets/images/"
    const dir = p.split('/').slice(0, -1).join('/') + '/';
    dirs.add(dir);
  }

  const assetBlock = [...dirs]
    .sort()
    .map((d) => `    - ${d}`)
    .join('\n');

  const injection = `  assets:\n${assetBlock}\n`;

  if (pubspec.includes('uses-material-design: true')) {
    return pubspec.replace('uses-material-design: true', `uses-material-design: true\n${injection}`);
  }
  return pubspec + `\nflutter:\n${injection}`;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function projectAssemblerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const screens = (state.designIR?.screens ?? []) as IRScreen[];

  const projectBundle =
    state.targetFramework === 'flutter'
      ? assembleFlutter(state, screens)
      : assembleReactNative(state, screens);

  return {
    projectBundle,
    currentStep: 'ProjectAssemblerAgent',
    logs: [
      makeLogEntry(
        'success',
        `Assembled "${projectBundle.projectName}" — ${projectBundle.files.length} files, ` +
        `${projectBundle.assets.length} assets`
      ),
    ],
  };
}
