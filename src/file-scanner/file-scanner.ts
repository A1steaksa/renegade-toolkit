
import * as vscode from 'vscode';
import { Module } from '../module';
import { config } from '../extension';

type FileChangeCallback = ( uri: vscode.Uri, fileContent: string ) => void;

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

    private static workspaceName: string;
    private static scanPath: vscode.RelativePattern;

    public static override initialize( context: vscode.ExtensionContext ){

        this.fileScanCallbacks = [];

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

    public static start(){
        // Track new file changes
        this.setupFileWatchers();
        
        // Find files that already exist
        vscode.workspace.findFiles( this.scanPath ).then( ( files ) => {
            this.scanFiles( files );
        } );
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

    public static addCallback( callback: FileChangeCallback ){
        this.fileScanCallbacks.push( callback );
    }

    public static removeCallback( callback: FileChangeCallback ){
        const index = this.fileScanCallbacks.indexOf( callback );
        if( index >= 0 ){
            this.fileScanCallbacks.splice( index, 1 );
        }
    }

    private static async getFileContent( file: vscode.Uri ) : Promise<string | undefined> {
        const fileContentBytes = await vscode.workspace.fs.readFile( file );
        return fileContentBytes.toString();
    }

    private static sendFileChangeCallbacks( files: vscode.Uri[] ){

        files.forEach( file => {
            const fileContent = FileScanner.getFileContent( file );
            if( fileContent !== undefined ){
                FileScanner.fileChangeCallbacks
            }



        } );

    }

    private static scanFiles( files: vscode.Uri[] ) {
        files.forEach( ( file, index ) => {
            vscode.workspace.fs
                .readFile( file )
                .then(
                    ( fileContentBytes ) => {
                        const fileContent = fileContentBytes.toString();
                        if( fileContent ) {
                            this.fileScanCallbacks.forEach( callback => {
                                callback( file, fileContent );
                            } );
                        }
                    }
                );
        } );
    }
}