import type { KiriyaModule } from "../../core/domain/module.js";
import { CleanBuilds } from "./application/clean-builds.use-case.js";
import { ComparePaths } from "./application/compare-paths.use-case.js";
import { CopyPaths } from "./application/copy-paths.use-case.js";
import { CreatePaths } from "./application/create-paths.use-case.js";
import { DeletePaths } from "./application/delete-paths.use-case.js";
import { FindDuplicates } from "./application/find-duplicates.use-case.js";
import { FindFiles } from "./application/find-files.use-case.js";
import { HashFiles } from "./application/hash-files.use-case.js";
import { ListEntries } from "./application/list-entries.use-case.js";
import { MeasureFolders } from "./application/measure-folders.use-case.js";
import { MovePaths } from "./application/move-paths.use-case.js";
import { ReadText } from "./application/read-text.use-case.js";
import { RenamePaths } from "./application/rename-paths.use-case.js";
import { ReplaceText } from "./application/replace-text.use-case.js";
import { SearchText } from "./application/search-text.use-case.js";
import { ShowInfo } from "./application/show-info.use-case.js";
import { ShowTree } from "./application/show-tree.use-case.js";
import { SyncFolders } from "./application/sync-folders.use-case.js";
import { cleanView } from "./presentation/clean.view.js";
import { compareView } from "./presentation/compare.view.js";
import { copyView } from "./presentation/copy.view.js";
import { deleteView } from "./presentation/delete.view.js";
import { dupesView } from "./presentation/dupes.view.js";
import { findView } from "./presentation/find.view.js";
import { grepView } from "./presentation/grep.view.js";
import { hashView } from "./presentation/hash.view.js";
import { infoView } from "./presentation/info.view.js";
import { listView } from "./presentation/list.view.js";
import { moveView } from "./presentation/move.view.js";
import { newView } from "./presentation/new.view.js";
import { readView } from "./presentation/read.view.js";
import { renameView } from "./presentation/rename.view.js";
import { replaceView } from "./presentation/replace.view.js";
import { sizeView } from "./presentation/size.view.js";
import { syncView } from "./presentation/sync.view.js";
import { treeView } from "./presentation/tree.view.js";

export const filesModule: KiriyaModule = {
  id: "files",
  summary: "files.summary",
  register(registrar, ports) {
    const { fileSystem, fileContent, hasher, processRunner, trash, environment, clock, protectedPaths } = ports;
    registrar.add(new CreatePaths(fileSystem, environment), newView);
    registrar.add(new ListEntries(fileSystem), listView);
    registrar.add(new ShowTree(fileSystem), treeView);
    registrar.add(new ShowInfo(fileSystem, hasher, environment), infoView);
    registrar.add(new ReadText(fileSystem, fileContent), readView);
    registrar.add(new FindFiles(fileSystem, clock), findView);
    registrar.add(new SearchText(fileSystem, fileContent), grepView);
    registrar.add(new HashFiles(fileSystem, hasher), hashView);
    registrar.add(new FindDuplicates(fileSystem, hasher), dupesView);
    registrar.add(new ComparePaths(fileSystem, fileContent, hasher), compareView);
    registrar.add(new CopyPaths(fileSystem, protectedPaths, environment), copyView);
    registrar.add(new MovePaths(fileSystem, trash, protectedPaths, environment), moveView);
    registrar.add(new RenamePaths(fileSystem, protectedPaths), renameView);
    registrar.add(new ReplaceText(fileSystem, fileContent), replaceView);
    registrar.add(new DeletePaths(fileSystem, trash, protectedPaths), deleteView);
    registrar.add(new CleanBuilds(fileSystem, processRunner, protectedPaths), cleanView);
    registrar.add(new SyncFolders(fileSystem, environment), syncView);
    registrar.add(new MeasureFolders(fileSystem), sizeView);
  },
};
