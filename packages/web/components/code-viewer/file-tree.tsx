'use client';

/**
 * Shared file tree utilities and <FileTreeView> component.
 * Used by CodeViewer (sidebar) and ProjectStructureCard (result page overview).
 */

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreeNode =
  | { kind: 'dir';  name: string; path: string; children: TreeNode[] }
  | { kind: 'file'; name: string; path: string; language: string };

// ─── Tree builder ─────────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;
  language: string;
}

export function buildFileTree(files: FileEntry[]): TreeNode[] {
  const root: Record<string, TreeNode> = {};

  function ensureDir(segments: string[]): TreeNode & { kind: 'dir' } {
    const path = segments.join('/');
    if (!root[path]) {
      root[path] = { kind: 'dir', name: segments[segments.length - 1]!, path, children: [] };
      if (segments.length > 1) {
        const parent = ensureDir(segments.slice(0, -1));
        parent.children.push(root[path]!);
      }
    }
    return root[path] as TreeNode & { kind: 'dir' };
  }

  const topLevel: TreeNode[] = [];

  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length === 1) {
      const node: TreeNode = { kind: 'file', name: parts[0]!, path: f.path, language: f.language };
      topLevel.push(node);
    } else {
      const dirSegments = parts.slice(0, -1);
      const dir = ensureDir(dirSegments);
      dir.children.push({
        kind: 'file',
        name: parts[parts.length - 1]!,
        path: f.path,
        language: f.language,
      });
      // Add top-level dirs
      const topKey = dirSegments[0]!;
      const topNode = root[topKey];
      if (topNode && !topLevel.find((n) => n.path === topNode.path)) {
        topLevel.push(topNode);
      }
    }
  }

  return topLevel;
}

// ─── File extension badge ─────────────────────────────────────────────────────

function ExtBadge({ name, theme }: { name: string; theme: 'light' | 'dark' | 'vscode' }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // [label, darkColor, lightColor, vscodeColor]
  const [label, darkColor, lightColor, vscodeColor] = (() => {
    switch (ext) {
      case 'tsx': case 'ts': return ['TS',  'text-blue-400',   'text-blue-500',   '#4ec9b0'];
      case 'jsx': case 'js': return ['JS',  'text-yellow-400', 'text-yellow-600', '#dcdc8c'];
      case 'dart':           return ['◆',   'text-teal-400',   'text-teal-600',   '#4ec9b0'];
      case 'json':           return ['{}',  'text-yellow-600', 'text-yellow-700', '#dcdc8c'];
      case 'yaml': case 'yml': return ['≡', 'text-orange-400', 'text-orange-500', '#f4b73e'];
      case 'md':             return ['MD',  'text-gray-500',   'text-gray-400',   '#cccccc'];
      case 'gitignore':      return ['.gi', 'text-gray-600',   'text-gray-400',   '#858585'];
      default:               return ['·',   'text-gray-600',   'text-gray-400',   '#858585'];
    }
  })();

  if (theme === 'vscode') {
    return (
      <span className="flex-shrink-0 font-mono text-[9px] font-bold w-4 text-center" style={{ color: vscodeColor as string }}>
        {label}
      </span>
    );
  }

  return (
    <span className={`flex-shrink-0 font-mono text-[9px] font-bold w-4 text-center ${theme === 'light' ? lightColor : darkColor}`}>
      {label}
    </span>
  );
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

function TreeItemRow({
  node,
  depth,
  activeFile,
  onSelectFile,
  expandedDirs,
  toggleDir,
  theme = 'dark',
}: {
  node: TreeNode;
  depth: number;
  activeFile: string;
  onSelectFile: (path: string) => void;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  theme?: 'light' | 'dark' | 'vscode';
}) {
  const indent = depth * 12;

  // vscode = exact VS Code Explorer palette; dark = old generic dark; light = white surface
  const dirHover    = theme === 'light' ? 'hover:bg-gray-100 hover:text-gray-700'
                    : theme === 'vscode' ? ''   // handled via style prop below
                    : 'hover:bg-gray-800 hover:text-gray-200';
  const dirTextCls  = theme === 'light' ? 'text-gray-500'
                    : theme === 'vscode' ? ''
                    : 'text-gray-400';
  const folderLabel = theme === 'light'  ? 'text-[10px] font-semibold uppercase tracking-wider text-gray-600'
                    : theme === 'vscode' ? 'text-[11px] font-medium'
                    : 'text-[10px] font-semibold uppercase tracking-wider text-gray-500';

  if (node.kind === 'dir') {
    const isOpen = expandedDirs.has(node.path);

    if (theme === 'vscode') {
      return (
        <>
          <button
            onClick={() => toggleDir(node.path)}
            className="flex w-full items-center gap-1.5 py-0.5 text-left transition-colors"
            style={{ paddingLeft: `${4 + indent}px`, color: '#cccccc' }}
            onMouseOver={e => (e.currentTarget.style.background = '#2a2d2e')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className={`flex-shrink-0 text-[8px] transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} style={{ color: '#c5c5c5' }}>
              ▶
            </span>
            <span className={folderLabel} style={{ color: '#cccccc' }}>
              {node.name}
            </span>
            <span className="ml-auto pr-2 text-[9px]" style={{ color: '#6c6c6c' }}>
              {countFiles(node)}
            </span>
          </button>
          {isOpen && node.children.map((child) => (
            <TreeItemRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              theme={theme}
            />
          ))}
        </>
      );
    }

    return (
      <>
        <button
          onClick={() => toggleDir(node.path)}
          className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors ${dirTextCls} ${dirHover}`}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className={`flex-shrink-0 text-[10px] transition-transform duration-150 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'} ${isOpen ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className={folderLabel}>
            {node.name}/
          </span>
          <span className={`ml-auto text-[9px] ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
            {countFiles(node)}
          </span>
        </button>
        {isOpen && node.children.map((child) => (
          <TreeItemRow
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            onSelectFile={onSelectFile}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
            theme={theme}
          />
        ))}
      </>
    );
  }

  const isActive = node.path === activeFile;

  if (theme === 'vscode') {
    return (
      <button
        onClick={() => onSelectFile(node.path)}
        title={node.path}
        className="flex w-full items-center gap-1.5 py-0.5 text-left transition-colors"
        style={{
          paddingLeft: `${16 + indent}px`,
          paddingRight: '8px',
          background: isActive ? '#37373d' : 'transparent',
          color: isActive ? '#ffffff' : '#cccccc',
          borderLeft: isActive ? '2px solid #f15b40' : '2px solid transparent',
        }}
        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = '#2a2d2e'; }}
        onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <ExtBadge name={node.name} theme="vscode" />
        <span className="truncate text-xs">{node.name}</span>
      </button>
    );
  }

  const activeClass   = theme === 'light' ? 'bg-brand-50 text-brand-600 border-l-2 border-brand-400' : 'bg-brand-500/15 text-brand-300';
  const inactiveClass = theme === 'light' ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-700' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200';

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      title={node.path}
      className={`flex w-full items-center gap-1.5 rounded py-1 text-left transition-colors ${
        isActive ? activeClass : inactiveClass
      }`}
      style={{ paddingLeft: `${8 + indent}px`, paddingRight: '8px' }}
    >
      <ExtBadge name={node.name} theme={theme} />
      <span className="truncate text-xs">{node.name}</span>
    </button>
  );
}

function countFiles(node: TreeNode): number {
  if (node.kind === 'file') return 1;
  return node.children.reduce((s, c) => s + countFiles(c), 0);
}

// ─── Public component ─────────────────────────────────────────────────────────

interface FileTreeViewProps {
  files: FileEntry[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  /** Extra className for the scroll container */
  className?: string;
  /** 'light' for white/gray-50 containers, 'dark' for generic dark sidebar, 'vscode' for VS Code Explorer style */
  theme?: 'light' | 'dark' | 'vscode';
}

export function FileTreeView({ files, activeFile, onSelectFile, className, theme = 'dark' }: FileTreeViewProps) {
  const tree = buildFileTree(files);

  // Collect all dir paths for default-expand
  function allDirPaths(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) =>
      n.kind === 'dir' ? [n.path, ...allDirPaths(n.children)] : []
    );
  }

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set(allDirPaths(tree))
  );

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const totalFiles = files.length;
  const totalDirs  = allDirPaths(tree).length;
  const statsColor = theme === 'light' ? 'text-gray-400' : 'text-gray-600';
  const statsStyle = theme === 'vscode' ? { color: '#6c6c6c' } : undefined;

  return (
    <div className={className}>
      {totalDirs > 0 && (
        <div className={`px-3 pb-1 pt-2 text-[9px] ${statsColor}`} style={statsStyle}>
          {totalFiles} files · {totalDirs} folder{totalDirs !== 1 ? 's' : ''}
        </div>
      )}
      {tree.map((node) => (
        <TreeItemRow
          key={node.path}
          node={node}
          depth={0}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          theme={theme}
        />
      ))}
    </div>
  );
}
