import * as vscode from 'vscode';
import { Module } from '../module';
import { CppScanner } from '../file-scanner/cpp-scanner';
import { CppCachedClass } from './cpp-cached-class';
import { HeaderScanner } from '../file-scanner/header-scanner';
import { config } from '../extension';
import { ConfigUtils } from '../utils/config-utils';
import { FileUtils } from '../utils/file-utils';
import { FileScanner } from '../file-scanner/file-scanner';
import { TextUtils } from '../utils/text-utils';

/**
 * The classes that are saved and loaded from the CPP Class Cache file.  
 * These must be convertable to and from `CppCachedClass` but with a
 * hopefully smaller footprint on disk.
 */
class CppClassFileCacheEntry{

    private static cppWorkspaceFolder: vscode.WorkspaceFolder;
    private static cppWorkspaceName: string;

    public static fromCppCachedClass( cachedclass: CppCachedClass ) : CppClassFileCacheEntry {
        let headerPath: string | undefined;
        if( cachedclass.headerFile !== undefined ){
            headerPath = vscode.workspace.asRelativePath( cachedclass.headerFile );
        }

        let cppPath: string | undefined;
        if( cachedclass.cppFile !== undefined ){
            cppPath = vscode.workspace.asRelativePath( cachedclass.cppFile );
        }

        return new CppClassFileCacheEntry(
            cachedclass.name,
            headerPath,
            cppPath
        );
    }

    public toCppCachedClass() : CppCachedClass {
        let header: vscode.Uri | undefined;
        if( this.header !== undefined ){
            header = CppClassFileCacheEntry.relativePathToUri( this.header );
        }

        let cpp: vscode.Uri | undefined;
        if( this.cpp !== undefined ){
            cpp = CppClassFileCacheEntry.relativePathToUri( this.cpp );
        }

        return new CppCachedClass( this.name, header, cpp );
    }

    public static relativePathToUri( relativePath: string ): vscode.Uri {
        if( this.cppWorkspaceFolder === undefined || this.cppWorkspaceName === undefined ){
            const cppWorkspaceName = config.get<string>( "CppWorkspaceFolderName" );
            if( cppWorkspaceName === undefined ){
                throw new Error( "Unable to retrieve CPP Workspace Name from config" );
            }
            this.cppWorkspaceName = cppWorkspaceName;
    
            for (let workspaceFolderIndex = 0; workspaceFolderIndex < vscode.workspace.workspaceFolders!.length; workspaceFolderIndex++) {
                const workspaceFolder = vscode.workspace.workspaceFolders![workspaceFolderIndex];
                if( workspaceFolder.name === cppWorkspaceName ){
                    this.cppWorkspaceFolder = workspaceFolder;
                    break;
                }
            }
    
            if( this.cppWorkspaceFolder === undefined ){
                throw new Error( `No workspace folder matches expected CPP Workspace Name from config: '${cppWorkspaceName}'` );
            }
        }

        relativePath = TextUtils.removeBeginnings( relativePath, [this.cppWorkspaceName] );

        return vscode.Uri.joinPath( this.cppWorkspaceFolder.uri, relativePath );
    }
    
    private constructor(
        public name: string,
        public header: string | undefined,
        public cpp: string | undefined
    ){}
}

export class CppClassCache extends Module {

    /** The cache of C++ classes */
    private static cppClassCache: CppCachedClass[];

    private static cppClassCacheFile: vscode.Uri;


    private static scanPath = "**/*.{cpp,h}";


    public static initialize( context: vscode.ExtensionContext ): void {
        this.initializeCache();
    }

    private static async initializeCache(){

        // Create the cache file's full URI
        // The cache is stored in the Lua project files so the Lua Workspace path is used
        this.cppClassCacheFile = FileUtils.relativeLuaWorkspacePathToUri( ConfigUtils.getString( "CppClassCacheFile" ) );
        
        let cacheFileExists = await FileUtils.exists( this.cppClassCacheFile );
        
        // Try to load the cache file if it exists
        let needToBuildCache = false;
        if( cacheFileExists ){
            const isCacheFileGood = await this.loadCache();
            
            if( isCacheFileGood ){
                vscode.window.showInformationMessage( "Loaded CPP Cache from file" );
            }else{
                needToBuildCache = true;
            }
        }else{
            needToBuildCache = true;
        }

        // Build the cache if the cache file doesn't exist or if it's empty
        if( needToBuildCache ){
            vscode.window.withProgress(
                {
                    title: "Building the CPP Class Cache",
                    location: vscode.ProgressLocation.Notification
                },
                this.buildCache
            );
        }
    }

    private static async getSymbols( file: vscode.Uri ): Promise<vscode.DocumentSymbol[]> {
        const fileSymbols : vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand(
            "vscode.executeDocumentSymbolProvider",
            file
        );
        
        if( fileSymbols === undefined ){
            return [];
        }

        return fileSymbols;
    }

    private static async buildCache( progress: vscode.Progress<{message: string|undefined, incremenet: number|undefined}>){
        // Empty the cache so we can build it
        CppClassCache.cppClassCache = [];
        
        const filesToScan = await vscode.workspace.findFiles( CppClassCache.scanPath );

        const progressIncrement = ( 1 / filesToScan.length ) * 100;

        // Create the cache in memory
        for (let fileIndex = 0; fileIndex < filesToScan.length; fileIndex++) {
            const fileToScan = filesToScan[fileIndex];

            // Categorize the file we're scanning as .cpp or .h
            let headerFile: vscode.Uri | undefined;
            let cppFile: vscode.Uri | undefined;
            if( fileToScan.path.endsWith( ".cpp" ) ){
                cppFile = fileToScan;
            }else if( fileToScan.path.endsWith( ".h" ) ){
                headerFile = fileToScan;
            }else{
                throw new Error( `Encountered unknown file type while building CPP Class Cache: '${fileToScan.path}'` );
            }

            // Scan the file for its symbols
            const fileSymbols = await CppClassCache.getSymbols( fileToScan );

            // We only care about classes right now
            const classSymbols = fileSymbols.filter(
                file => file.kind === vscode.SymbolKind.Class
            );

            // Add each of the file's classes to the cache
            for (let classIndex = 0; classIndex < classSymbols.length; classIndex++) {
                const classSymbol = classSymbols[classIndex];
                
                CppClassCache.storeClass( classSymbol.name, headerFile, cppFile );
            }

            // Update the UI to show our progress
            const message = `${fileIndex}/${filesToScan.length} (${ Math.floor( fileIndex / filesToScan.length * 100 ) }%)`;
            progress.report( {
                message: message,
                incremenet: progressIncrement
            } );
        }

        // Save the cache to the disk
        CppClassCache.saveCache();
    } 

    /**
     * @returns `true` if the cache file was loaded successfully, `false` otherwise
     */
    private static async loadCache() : Promise<boolean> {
        const cacheString = await FileUtils.read( this.cppClassCacheFile );

        if( cacheString === undefined ){
            this.cppClassCache = [];
            return false;
        }

        if( cacheString.length === 0 ){
            this.cppClassCache = [];
            return false;
        }

        const fileCacheEntries = JSON.parse( cacheString ) as CppClassFileCacheEntry[];

        // Convert the cache file entries into in-memory cache entries
        this.cppClassCache = [];
        for (let cacheFileEntryIndex = 0; cacheFileEntryIndex < fileCacheEntries.length; cacheFileEntryIndex++) {
            const fileCacheEntry = Object.setPrototypeOf(
                fileCacheEntries[cacheFileEntryIndex],
                CppClassFileCacheEntry.prototype
            );

            const memoryCacheEntry = fileCacheEntry.toCppCachedClass();

            this.cppClassCache.push( memoryCacheEntry );
        }

        return true;
    }

    private static saveCache(){
        // Cache files need to be converted to their savable counterparts
        const convertedCache = [];
        for (let cachedClassIndex = 0; cachedClassIndex < this.cppClassCache.length; cachedClassIndex++) {
            const cachedClass = this.cppClassCache[cachedClassIndex];
            convertedCache.push( CppClassFileCacheEntry.fromCppCachedClass( cachedClass ) );
        }

        const cacheString = JSON.stringify( convertedCache );
        vscode.workspace.fs.writeFile( this.cppClassCacheFile, Buffer.from( cacheString ) );
    }

    public static storeClass( name: string, headerFile: vscode.Uri | undefined, cppFile: vscode.Uri | undefined ){
        // Update an existing entry if one exists
        for (let cachedClassIndex = 0; cachedClassIndex < this.cppClassCache.length; cachedClassIndex++) {
            const cachedClass = this.cppClassCache[cachedClassIndex];
            if( cachedClass.name === name ){
                // Update header file
                if( cachedClass.headerFile === undefined && headerFile !== undefined ){
                    console.log( `Updating header file for existing entry '${name}'` );
                    cachedClass.headerFile = headerFile;
                }

                // Update CPP file
                if( cachedClass.cppFile === undefined && cppFile !== undefined ){
                    console.log( `Updating CPP file for existing entry '${name}'` );
                    cachedClass.cppFile = cppFile;
                }

                this.cppClassCache[cachedClassIndex] = cachedClass;
                return;
            }
        }

        // Create a new entry if none exists already
        this.cppClassCache.push( new CppCachedClass( name, headerFile, cppFile ) );
    }

    public static getClassByName( className: string ): CppCachedClass | undefined {
        for (let classIndex = 0; classIndex < this.cppClassCache.length; classIndex++) {
            const cppClass = this.cppClassCache[classIndex];
            if( cppClass.name === className ){
                return cppClass;
            }
        }
    }

    public static getClassesByUri( uri: vscode.Uri ) : CppCachedClass[] {
        const classes: CppCachedClass[] = [];

        for( let classIndex = 0; classIndex < this.cppClassCache.length; classIndex++ ){
            const cppClass = this.cppClassCache[classIndex];

            if( cppClass.cppFile?.path === uri.path || cppClass.headerFile?.path === uri.path ){
                classes.push( cppClass );
            }
        }

        return classes;
    }
}