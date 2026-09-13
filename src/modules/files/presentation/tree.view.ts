import { message } from "../../../core/domain/message.js";
import type { TextView } from "../../../core/domain/view.js";
import type { TreeNode, TreeOutput } from "../application/show-tree.use-case.js";

export const treeView: TextView<TreeOutput> = (output, format) => {
  const lines = [format.bold(format.path(output.root))];
  const draw = (nodes: readonly TreeNode[], prefix: string): void => {
    nodes.forEach((node, index) => {
      const last = index === nodes.length - 1;
      const name = node.kind === "directory" ? format.bold(`${node.name}/`) : node.name;
      const target = node.target === null ? "" : format.dim(` -> ${node.target}`);
      const note = node.closed
        ? format.dim(`  ${format.text(message("files.tree.not-opened"))}`)
        : node.unreadable
          ? format.dim(`  ${format.text(message("files.tree.unreadable"))}`)
          : "";
      lines.push(`${prefix}${last ? "└── " : "├── "}${name}${target}${note}`);
      draw(node.children, `${prefix}${last ? "    " : "│   "}`);
    });
  };
  draw(output.nodes, "");
  lines.push(
    "",
    format.text(message("files.tree.total", { folders: output.directories, files: output.files, depth: output.depth })),
  );
  return lines;
};
