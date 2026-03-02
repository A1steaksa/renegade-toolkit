import { FileScanner } from './file-scanner';

/**
 * Responsible for scanning through the project's C++ Header files and extracting data from them that is used by other modules
 */
export class HeaderScanner extends FileScanner {
    protected static override workspacePropertyName: string = "CppWorkspaceName";
    protected static override fileNameFilter: string = "**/*.h";
}