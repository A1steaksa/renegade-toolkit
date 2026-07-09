import * as vscode from 'vscode';
import { ConfigUtils } from '../../utils/config-utils';
import { TextUtils } from '../../utils/text-utils';

/// Represents all of the file paths that, together, comprise a C++ class's definition
export class CppClassFiles {
    constructor(
        public name: string,
        public files: vscode.Uri[]
    ){}

    public equals( otherClass: CppClassFiles ) : boolean {
        return this.name.toLowerCase() === otherClass.name.toLowerCase();
    }
}

/**
 * The classes that are saved and loaded from the CPP Class Cache file.  
 * These must be convertable to and from `CppClassFiles` but with a
 * hopefully smaller footprint on disk.
 */
export class CompressedCppClassFiles {

    private static cppWorkspaceFolder: vscode.WorkspaceFolder;
    private static cppWorkspaceName: string;

    public static fromCppCachedClass( cachedclass: CppClassFiles ) : CompressedCppClassFiles {
        const paths: string[] = [];
        for (let fileIndex = 0; fileIndex < cachedclass.files.length; fileIndex++) {
            const file = cachedclass.files[fileIndex];
            paths.push( vscode.workspace.asRelativePath( file ) );
        }

        return new CompressedCppClassFiles(
            cachedclass.name,
            paths
        );
    }

    public toCppCachedClass() : CppClassFiles {
        const paths: vscode.Uri[] = [];
        for (let pathIndex = 0; pathIndex < this.filePaths.length; pathIndex++) {
            const path = this.filePaths[pathIndex];
            paths.push( CompressedCppClassFiles.relativePathToUri( path ) );
        }

        return new CppClassFiles( this.name, paths );
    }

    public static relativePathToUri( relativePath: string ): vscode.Uri {
        if( this.cppWorkspaceFolder === undefined || this.cppWorkspaceName === undefined ){
            this.cppWorkspaceName = ConfigUtils.GetCppWorkspaceFolderName();
    
            for (let workspaceFolderIndex = 0; workspaceFolderIndex < vscode.workspace.workspaceFolders!.length; workspaceFolderIndex++) {
                const workspaceFolder = vscode.workspace.workspaceFolders![workspaceFolderIndex];
                if( workspaceFolder.name === this.cppWorkspaceName ){
                    this.cppWorkspaceFolder = workspaceFolder;
                    break;
                }
            }
    
            if( this.cppWorkspaceFolder === undefined ){
                throw new Error( `No workspace folder matches expected CPP Workspace Name from config: '${this.cppWorkspaceName}'` );
            }
        }

        relativePath = TextUtils.removeBeginnings( relativePath, [this.cppWorkspaceName] );

        return vscode.Uri.joinPath( this.cppWorkspaceFolder.uri, relativePath );
    }
    
    private constructor(
        public name: string,
        public filePaths: string[]
    ){}
}