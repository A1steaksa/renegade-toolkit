
export class LuaImportable {
    constructor( public className: string, public importPath: string ) { }
}

export class LuaImportCache {

    /** The cache of Lua classes and their import paths */
    private static importables: Map<string, string> = new Map();


    public static storeImportable( className: string, importPath: string ) {
        this.importables.set( className, importPath );
    }

    public static getImportableByClassName( className: string ): LuaImportable | undefined {
        const importPath = this.importables.get( className );
        if( importPath === undefined ) {
            return;
        }

        return new LuaImportable( className, importPath );
    }

    public static removeImportableByClassName( className: string ) {
        this.importables.delete( className );
    }

    /**
     * Finds and removes all stored importables that use a given import path from the cache.
     * Useful when renaming classes and libraries to avoid out of date importables remaining in the cache.
     */
    public static removeImportablesByPath( pathToRemove: string ) {
        let keysToRemove: Set<string> = new Set();

        // Find the keys with this same path
        this.importables.forEach( ( value, key, map ) => {
            if( value === pathToRemove ) {
                keysToRemove.add( key );
            }
        } );

        // Remove those keys from the importables cache
        keysToRemove.forEach( key => {
            this.importables.delete( key );
        } );
    }
}