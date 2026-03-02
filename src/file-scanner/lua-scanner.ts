import { FileScanner } from './file-scanner';

/**
 * Responsible for scanning through the project's Lua files and extracting data from them that is used by other modules
 */
export class LuaScanner extends FileScanner {
    protected static override workspacePropertyName: string = "LuaWorkspaceFolderName";
    protected static override fileNameFilter: string = "**/*.lua";
}