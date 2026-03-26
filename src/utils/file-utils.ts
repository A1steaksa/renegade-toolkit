import * as vscode from 'vscode';
import { config } from '../extension';
import { ConfigUtils } from './config-utils';
import { TextUtils } from './text-utils';

export class FileUtils {

    private static cppWorkspaceFolderName: string;
    private static cppWorkspaceFolder: vscode.WorkspaceFolder;

    private static luaWorkspaceFolderName: string;
    private static luaWorkspaceFolder: vscode.WorkspaceFolder;


// #region Accessors

    private static getCppWorkspaceFolderName() : string {
        if( this.cppWorkspaceFolderName === undefined ){
            this.cppWorkspaceFolderName = ConfigUtils.getString( "CppWorkspaceFolderName" );
        }
        return this.cppWorkspaceFolderName;
    }

    public static getCppWorkspaceFolder(): vscode.WorkspaceFolder {
        if( this.cppWorkspaceFolder === undefined ){
            const cppWorkspaceFolderName = this.getCppWorkspaceFolderName();
            const cppWorkspaceFolder = this.getWorkspaceFolder( cppWorkspaceFolderName );

            if( cppWorkspaceFolder === undefined ){
                throw new Error( `No workspace folder matches expected CPP Workspace Folder Name '${cppWorkspaceFolderName}'` );
            }
            this.cppWorkspaceFolder = cppWorkspaceFolder;
        }

        return this.cppWorkspaceFolder;
    }

    private static getLuaWorkspaceFolderName() : string {
        if( this.luaWorkspaceFolderName === undefined ){
            this.luaWorkspaceFolderName = ConfigUtils.getString( "LuaWorkspaceFolderName" );
        }
        return this.luaWorkspaceFolderName;
    }

    public static getLuaWorkspaceFolder(): vscode.WorkspaceFolder {
        if( this.luaWorkspaceFolder === undefined ){
            const luaWorkspaceFolderName = this.getLuaWorkspaceFolderName();
            const luaWorkspaceFolder = this.getWorkspaceFolder( luaWorkspaceFolderName );

            if( luaWorkspaceFolder === undefined ){
                throw new Error( `No workspace folder matches expected Lua Workspace Folder Name '${luaWorkspaceFolderName}'` );
            }
            this.luaWorkspaceFolder = luaWorkspaceFolder;
        }

        return this.luaWorkspaceFolder;
    }

    public static getWorkspaceFolder( name: string ) : vscode.WorkspaceFolder | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if( workspaceFolders === undefined ){
            throw new Error( `Workspace folders are empty while getting workspace '${name}'` );
        }

        for (let workspaceFolderIndex = 0; workspaceFolderIndex < workspaceFolders.length; workspaceFolderIndex++) {
            const workspaceFolder = workspaceFolders[workspaceFolderIndex];
            if( workspaceFolder.name === name ){
                return workspaceFolder;
            }
        }
    }
// #endregion


// #region Path Conversions

    public static uriToRelativeCppWorkspacePath( uri: vscode.Uri ){
        let relativePath = vscode.workspace.asRelativePath( uri );

        relativePath = TextUtils.removeBeginnings(
            relativePath,
            [
                "/", 
                this.getCppWorkspaceFolderName(),
                this.getLuaWorkspaceFolderName()
            ]
         );

        return relativePath;
    }

    public static relativeCppWorkspacePathToUri( relativeCppPath: string ): vscode.Uri {
        return vscode.Uri.joinPath( this.getCppWorkspaceFolder().uri, relativeCppPath );
    }

    public static relativeLuaWorkspacePathToUri( relativeLuaPath: string ): vscode.Uri {
        return vscode.Uri.joinPath( this.getLuaWorkspaceFolder().uri, relativeLuaPath );
    }
// #endregion


// #region File Functions
    
    public static async exists( file: vscode.Uri ): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat( file );
            return true;
        } catch {
            return false;
        }
    }

    public static async read( file: vscode.Uri ): Promise<string> {
        return ( await vscode.workspace.fs.readFile( file ) ).toString();
    }

    public static async write( file: vscode.Uri, content: string ){
        await vscode.workspace.fs.writeFile( file, Buffer.from( content, "utf8" ) );
    }

// #endregion

}