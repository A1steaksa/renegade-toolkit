import { TextUtils } from "../utils/text-utils";
import { LuaClass } from "./importables/lua-class";
import { LuaEnum } from "./importables/lua-enum";

export class LuaImportableCache {

    /** The cache of Lua classes and their import paths */
    public static importableClasses: LuaClass[] = [];

    /** The cache of Lua class and the enums they contain */
    private static importableEnums: LuaEnum[] = [];


    public static storeImportableClass( luaImportableClass: LuaClass ) {
        this.importableClasses.push( luaImportableClass );
    }

    public static storeImportableEnums( luaImportableEnums: LuaEnum[] ) {
        this.importableEnums = this.importableEnums.concat( luaImportableEnums );
    }

    public static getLuaClassByName( className: string ): LuaClass | undefined {
        className = className.toLowerCase();

        return this.importableClasses.find( value => ( value.getStaticName().toLowerCase() === className ) );
    }
    
    public static getLuaClassesByNames( classNames: string[] ): LuaClass[] {
        const classes: LuaClass[] = [];

        for (let classNameIndex = 0; classNameIndex < classNames.length; classNameIndex++) {
            const className = classNames[classNameIndex];
            const luaClass = LuaImportableCache.getLuaClassByName( className );

            if( luaClass === undefined ){
                throw new Error( `Unable to find Lua class '${className}'` );
            }

            classes.push( luaClass );
        }

        return classes;
    }

    /** Retrieves an enum from a case-insensitive name */
    public static getLuaEnumByName( enumName: string ): LuaEnum | undefined {
        enumName = enumName.toLowerCase();

        for( let index = 0; index < this.importableEnums.length; index++ ){
            const luaEnum = this.importableEnums[index];
            if( luaEnum.getStaticName().toLowerCase() === enumName ){
                return luaEnum;
            }
        }
    }

    /** Attempts to find an enum with a slightly fuzzy search */
    public static findLuaEnumsByName( enumName: string ): LuaEnum[] {
        const lowerName = enumName.toLowerCase();

        const results: LuaEnum[] = [];

        // Try verbatim
        const verbatimResult = this.getLuaEnumByName( lowerName );
        if( verbatimResult !== undefined ){
            results.push( verbatimResult );
        }

        // Try without "enum" at the end
        if( lowerName.endsWith( "enum" ) ){
            const nameWithoutEnum = lowerName.substring( 0, lowerName.length - "enum".length );
            const enumWithoutEnum = LuaImportableCache.getLuaEnumByName( nameWithoutEnum );
            if( enumWithoutEnum !== undefined ){
                results.push( enumWithoutEnum );
            }

        // Try with "enum" at the end
        }else{
            const nameWithEnum = lowerName + "enum";
            const enumWithEnum = LuaImportableCache.getLuaEnumByName( nameWithEnum );
            if( enumWithEnum !== undefined ){
                results.push( enumWithEnum );
            }
        }

        return results;
    }

    /** Attempts to find a class with a slightly fuzzy search */
    public static findLuaClassesByName( className: string ): LuaClass[] {
        const lowerName = className.toLowerCase();

        const results: LuaClass[] = [];

        // Try verbatim
        const verbatimResult = this.getLuaClassByName( lowerName );
        if( verbatimResult !== undefined ){
            results.push( verbatimResult );
        }


        // Try without "class" at the end
        if( lowerName.endsWith( "class" ) ){
            const nameWithoutClass = lowerName.substring( 0, lowerName.length - "class".length ); 
            const classWithoutClass = LuaImportableCache.getLuaClassByName( nameWithoutClass );
            if( classWithoutClass !== undefined ){
                results.push( classWithoutClass );
            }

        // Try with "class" at the end
        }else{
            const nameWithClass = lowerName + "class";
            const classWithClass = LuaImportableCache.getLuaClassByName( nameWithClass );
            if( classWithClass !== undefined ){
                results.push( classWithClass );
            }
        }

        return results;
    }
}