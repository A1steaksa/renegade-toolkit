
import * as vscode from 'vscode';
import { Module } from '../module';
import { config } from '../extension';

type FileChangeCallback = ( uri: vscode.Uri, fileContent: string ) => void;
type InitialFileScanEndCallback = () => void;

/**
 * Responsible for scanning through one of the project's workspace directories and extracting data from them that is used by other modules
 */
export abstract class FileScanner extends Module {

    /** The name of the config key containing the workspace folder name to scan in */
    protected static workspacePropertyName: string;

    /** A filter to use to specify the files this scanner should find */
    protected static fileNameFilter: string;

    
    protected static fileScanCallbacks: FileChangeCallback[];
    protected static fileChangeCallbacks: FileChangeCallback[];
    protected static initialFileScanEndCallbacks: InitialFileScanEndCallback[];

    private static workspaceName: string;
    private static scanPath: vscode.RelativePattern;

    public static override initialize( context: vscode.ExtensionContext ){

        this.fileScanCallbacks = [];
        this.fileChangeCallbacks = [];
        this.initialFileScanEndCallbacks = [];

        const workspacePropertyName = config.get<string>( this.workspacePropertyName );
        if( workspacePropertyName === undefined ){
            vscode.window.showErrorMessage( "Unable to find config property: '" + this.workspacePropertyName + "'" );
            return;
        }
        
        this.workspaceName = workspacePropertyName.trim().toLowerCase();

        // Figure out the directory we should be looking in for files
        const workspaceFolder = vscode.workspace.workspaceFolders?.find(
            ( workspaceFolder ) => workspaceFolder.name.trim().toLowerCase() === this.workspaceName 
        );
        if( workspaceFolder === undefined ) {
            throw new Error( "Workspace folder '" + this.workspaceName + "' does not exist" );
        }
        this.scanPath = new vscode.RelativePattern( workspaceFolder, this.fileNameFilter );
    }

    public static async start(){
        // Track new file changes
        this.setupFileWatchers();
        
        // Find files that already exist
        const files = await vscode.workspace.findFiles( this.scanPath );

        // Scan the existing files
        await this.scanFiles( files );
            
        // Alert callbacks that we've finished with the initial scan
        for( let callbackIndex = 0; callbackIndex < this.initialFileScanEndCallbacks.length; callbackIndex++ ){
            this.initialFileScanEndCallbacks[callbackIndex]();
        }
    }

    private static setupFileWatchers() {
        const fileWatcher = vscode.workspace.createFileSystemWatcher( this.scanPath, false, false, false );

        vscode.workspace.onDidRenameFiles( ( event ) => {
            event.files.forEach( fileChange => {
                
            } );
        } );

        fileWatcher.onDidChange( ( fileUri ) => {
            this.scanFiles( [fileUri] );
        } );


        fileWatcher.onDidCreate( ( fileUri ) => {
            this.scanFiles( [fileUri] );
        } );


        fileWatcher.onDidDelete( ( fileUri) => {
            this.scanFiles( [fileUri] );
        } );
    }

    public static addFileChangeCallback( callback: FileChangeCallback ){
        this.fileScanCallbacks.push( callback );
    }

    public static removeFileChangeCallback( callback: FileChangeCallback ){
        const index = this.fileScanCallbacks.indexOf( callback );
        if( index >= 0 ){
            this.fileScanCallbacks.splice( index, 1 );
        }
    }

    public static addInitialFileScanEndCallback( callback: InitialFileScanEndCallback ){
        this.initialFileScanEndCallbacks.push( callback );
    }

    public static removeInitialFileScanEndCallback( callback: InitialFileScanEndCallback ){
        const index = this.initialFileScanEndCallbacks.indexOf( callback );
        if( index >= 0 ){
            this.initialFileScanEndCallbacks.splice( index, 1 );
        }
    }

    private static async scanFiles( files: vscode.Uri[] ) {
        for( let fileIndex = 0; fileIndex < files.length; fileIndex++ ){
            const file = files[fileIndex];
            const fileContent = ( await vscode.workspace.fs.readFile( file ) ).toString();
            for( let callbackIndex = 0; callbackIndex < this.fileScanCallbacks.length; callbackIndex++ ){
                const callback = this.fileScanCallbacks[callbackIndex];
                callback( file, fileContent );
            }
        }
    }
}