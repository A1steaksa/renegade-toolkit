import * as vscode from 'vscode';
import { Module } from '../module';
import { CompressedCppClassFiles, CppClassFiles } from './cpp-class-files';
import { ConfigUtils } from '../utils/config-utils';
import { FileUtils } from '../utils/file-utils';


export class CppClassCache extends Module {

    /** The cache of C++ classes */
    private static cppClassCache: CppClassFiles[];

    private static cppClassCacheFile: vscode.Uri;


    private static scanPath = "**/*.{cpp,h}";


    public static initialize( context: vscode.ExtensionContext ): void {
        this.initializeCache();
    }

    private static async initializeCache(){

        // Create the cache file's full URI
        // The cache is stored in the Lua project files so the Lua Workspace path is used
        this.cppClassCacheFile = FileUtils.relativeLuaWorkspacePathToUri( ConfigUtils.GetCppClassCacheFilePath() );
        
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

    private static async addFileToCache( file: vscode.Uri ){
        // Scan the file for its symbols
        const fileSymbols = await CppClassCache.getSymbols( file );

        // We only care about classes right now
        const classSymbols = fileSymbols.filter(
            file => file.kind === vscode.SymbolKind.Class
        );

        // Add each of the file's classes to the cache
        for (let classIndex = 0; classIndex < classSymbols.length; classIndex++) {
            const classSymbol = classSymbols[classIndex];
            CppClassCache.storeClass( classSymbol.name, file );
        }
    }

    private static async buildCache( progress: vscode.Progress<{message: string|undefined, incremenet: number|undefined}>){
        // Empty the cache so we can build it
        CppClassCache.cppClassCache = [];
        
        const filesToScan = await vscode.workspace.findFiles( CppClassCache.scanPath );

        const progressIncrement = ( 1 / filesToScan.length ) * 100;

        // Create the cache in memory
        for (let fileIndex = 0; fileIndex < filesToScan.length; fileIndex++) {
            const fileToScan = filesToScan[fileIndex];

            await CppClassCache.addFileToCache( fileToScan );

            progress.report( { message: `${fileIndex}/${filesToScan.length} (${ Math.floor( ( fileIndex / filesToScan.length ) * 100 ) }%)`, incremenet: progressIncrement } );
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

        const fileCacheEntries = JSON.parse( cacheString ) as CompressedCppClassFiles[];

        // Convert the cache file entries into in-memory cache entries
        this.cppClassCache = [];
        for (let cacheFileEntryIndex = 0; cacheFileEntryIndex < fileCacheEntries.length; cacheFileEntryIndex++) {
            const fileCacheEntry = Object.setPrototypeOf(
                fileCacheEntries[cacheFileEntryIndex],
                CompressedCppClassFiles.prototype
            );

            const memoryCacheEntry = fileCacheEntry.toCppCachedClass();

            this.cppClassCache.push( memoryCacheEntry );
        }

        return true;
    }

    private static saveCache(){
        // Class files need to be converted to their compressed counterparts
        const convertedCache = [];
        for (let cachedClassIndex = 0; cachedClassIndex < this.cppClassCache.length; cachedClassIndex++) {
            const cachedClass = this.cppClassCache[cachedClassIndex];
            convertedCache.push( CompressedCppClassFiles.fromCppCachedClass( cachedClass ) );
        }

        const cacheString = JSON.stringify( convertedCache );
        vscode.workspace.fs.writeFile( this.cppClassCacheFile, Buffer.from( cacheString ) );
    }

    public static storeClass( className: string, file: vscode.Uri ){
        // Update an existing entry if one exists
        for( let cachedClassIndex = 0; cachedClassIndex < this.cppClassCache.length; cachedClassIndex++ ){
            const cachedClass = this.cppClassCache[cachedClassIndex];

            if( cachedClass.name !== className ){
                continue;
            }
            
            // Make sure this file isn't already in the class's file list
            for( let fileIndex = 0; fileIndex < cachedClass.files.length; fileIndex++ ){
                const cachedFile = cachedClass.files[fileIndex];
                if( cachedFile.path === file.path ){
                    // The file is already cached so we don't need to cache it again
                    return;
                }
            } 
            
            // Add the file to the class's file list
            cachedClass.files.push( file );
            return;
        }

        // Create a new entry if none exists already
        this.cppClassCache.push( new CppClassFiles( className, [file] ) );
    }

    public static cacheContainsFile( file: vscode.Uri ) : boolean {
        for (let cachedClassIndex = 0; cachedClassIndex < this.cppClassCache.length; cachedClassIndex++) {
            const cachedClass = this.cppClassCache[cachedClassIndex];
            for( let fileIndex = 0; fileIndex < cachedClass.files.length; fileIndex++ ){
                const cachedFile = cachedClass.files[fileIndex];
                if( cachedFile.path === file.path ){
                    return true;
                }
            } 
        }

        return false;
    }

    public static getClassByName( className: string ): CppClassFiles | undefined {
        for (let classIndex = 0; classIndex < this.cppClassCache.length; classIndex++) {
            const cppClass = this.cppClassCache[classIndex];
            if( cppClass.name === className ){
                return cppClass;
            }
        }
    }

    public static getClassesByUri( file: vscode.Uri ) : CppClassFiles[] {
        // Make sure the file is scanned and cached
        if( !this.cacheContainsFile( file ) ){
            console.log( `Extending the cache to include ${file.path}` );
            this.addFileToCache( file );
            this.saveCache();
        }

        const classes: CppClassFiles[] = [];

        // Find classes with this file in their file lists
        for( let classIndex = 0; classIndex < this.cppClassCache.length; classIndex++ ){
            const cppClass = this.cppClassCache[classIndex];

            let isClassConnectedToFile = false;
            for (let classFileIndex = 0; classFileIndex < cppClass.files.length; classFileIndex++) {
                const classFile = cppClass.files[classFileIndex];

                if( classFile.path === file.path ){
                    isClassConnectedToFile = true;
                    break;
                }
            }

            if( isClassConnectedToFile ){
                classes.push( cppClass );
            }
        }

        return classes;
    }
}