import * as vscode from 'vscode';
import { Module } from '../module';
import { LuaScanner } from '../file-scanner/lua-scanner';
import { config } from '../extension';
import { ConfigUtils } from '../utils/config-utils';

export class LuaBasedOn {
    constructor( public className: string, public filePath: string ) { }
}

export class FileConnection {
    constructor( public luaFile: vscode.Uri, public headerFile: vscode.Uri, public cppFile: vscode.Uri | undefined = undefined ) { }
}

export class ClassFileCache extends Module {

    private static luaBasedOnPattern = /^([A-z0-9\/]+)\s+within\s+((?:[A-z0-9\/])+\.(?:h(?:\s*\/\s*cpp)?|cpp(?:\s*\/\s*h)?))$/;

    private static cppWorkspaceFolder: vscode.WorkspaceFolder;

    private static fileConnectionCache: FileConnection[];

    public static override initialize( context: vscode.ExtensionContext ): void {
        this.fileConnectionCache = [];

        const workspaceFolderName = config.get<string>( "cpp.workspaceFolderName" );
        if( workspaceFolderName === undefined ) {
            vscode.window.showErrorMessage( "The extension config appears to be malformed" );
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if( workspaceFolders === undefined ) {
            vscode.window.showErrorMessage( "You must have a workspace open to use the Renegade Porting Toolkit" );
            return;
        }

        workspaceFolders.forEach( workspaceFolder => {
            if( workspaceFolder.name.trim().toLowerCase() === workspaceFolderName.trim().toLowerCase() ) {
                this.cppWorkspaceFolder = workspaceFolder;
                return;
            }
        } );
        if( this.cppWorkspaceFolder === undefined ) {
            vscode.window.showErrorMessage( "The C++ workspace folder '" + workspaceFolderName + "' could not be found" );
            return;
        }

        LuaScanner.addFileChangeCallback( ( file, fileContent ) => {
            this.handleLuaFileChange( file, fileContent );
        } );
    }


    private static async handleLuaFileChange( luaFile: vscode.Uri, fileContent: string ) {

        // Figure out which C++ file(s) the Lua was based on
        const luaBasedOn = this.getLuaBasedOnClassFile( luaFile, fileContent );
        if( luaBasedOn === undefined ) {
            return;
        }

        // Find the Header file
        const headerFile = await this.getCFile( luaBasedOn.filePath, ".h" );
        if( headerFile === undefined ) {
            return;
        }

        // Find the C++ file (optional)
        const cppFile = await this.getCFile( luaBasedOn.filePath, ".cpp" );

        // Add the connection to the cache
        this.addFileConnection( luaFile, headerFile, cppFile );
    }

    private static getLuaBasedOnClassFile( file: vscode.Uri, lua: string ): LuaBasedOn | undefined {
        const triggerPhrase = "Based on";

        const triggerIndex = lua.indexOf( triggerPhrase );
        if( triggerIndex < 0 ) {
            return;
        }

        const postTriggerPhraseIndex = triggerIndex + triggerPhrase.length;

        const firstLineEndIndex = lua.indexOf( "\n", postTriggerPhraseIndex );
        if( firstLineEndIndex < 0 ) {
            return;
        }

        const basedOnLine = lua.substring( postTriggerPhraseIndex, firstLineEndIndex ).trim();

        const results = this.luaBasedOnPattern.exec( basedOnLine );
        if( results === null ) {
            return;
        }

        const className = results[1].trim();
        const classPath = results[2].trim();

        return new LuaBasedOn( className, classPath );;
    }

    private static async getCFile( filePath: string, extension: string ): Promise<vscode.Uri | undefined> {

        // Remove the file extension from the file path
        const extensionStartIndex = filePath.lastIndexOf( "." );
        const pathWithoutExtension = filePath.substring( 0, extensionStartIndex );

        // Add the new extension
        const pathWithExtension = pathWithoutExtension + extension;

        const fullPath = vscode.Uri.joinPath( this.cppWorkspaceFolder.uri, pathWithExtension );

        // Confirm this is a real file before we return it
        let fileExists: boolean = false;
        await vscode.workspace.fs
            .stat( fullPath )
            .then( () => fileExists = true, () => { } );

        if( fileExists ) {
            return fullPath;
        }

        return undefined;
    }

    private static addFileConnection( luaFile: vscode.Uri, headerFile: vscode.Uri, cppFile: vscode.Uri | undefined ) {
        // Filter the connection cache before adding to it
        this.fileConnectionCache = this.fileConnectionCache.filter( ( fileConnection ) => {
            const compareNewLuaPath = luaFile.path.trim().toLowerCase();
            const compareThisLuaPath = fileConnection.luaFile.path.trim().toLowerCase();

            // Remove any existing cache entries that contain this lua file.
            // Lua files can contain, at most, one class and thus should not appear multiple times in the cache.
            // C++ and Header files do not have this same restriction. 
            if( compareNewLuaPath === compareThisLuaPath ) {
                return false;
            }

            return true;
        } );

        // Add the new connection
        this.fileConnectionCache.push(
            new FileConnection( luaFile, headerFile, cppFile )
        );
    }

    public static getFileConnection( file: vscode.Uri ): FileConnection | undefined {
        const filePath = file.path.trim().toLowerCase();

        let result;

        this.fileConnectionCache.forEach( ( fileConnection ) => {
            const headerPath = fileConnection.headerFile.path.trim().toLowerCase();
            const cppPath = fileConnection.cppFile?.path.trim().toLowerCase();
            const luaPath = fileConnection.luaFile.path.trim().toLowerCase();

            // Header
            if( headerPath === filePath ){
                result = fileConnection;
            }

            // C++
            if( cppPath === filePath ){
                result = fileConnection;
            }

            // Lua
            if( luaPath === filePath ){
                result = fileConnection;
            }
        } );

        return result;
    }
}
