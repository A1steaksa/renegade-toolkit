import { FileScanner } from './file-scanner';

/**
 * Responsible for scanning through the project's C++ files and extracting data from them that is used by other modules
 */
export class CppScanner extends FileScanner {
    protected static override workspacePropertyName: string = "CppWorkspaceName";
    protected static override fileNameFilter: string = "**/*.cpp";
}