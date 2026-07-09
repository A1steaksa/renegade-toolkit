import { LuaImportManager } from "../lua-import-manager/import-manager";
import { LuaImportableCache } from "../lua-import-manager/importable-class-cache";
import { TextUtils } from "../utils/text-utils";
import { LuaDataType } from "./old/old_lua-class-definition";

export class CppToLuaTypeConverter {


    private static simpleTypeNameConversions: { [cppTypeName: string]: string } = {
        "bool": "boolean",

        "float": "number",
        "float64": "number",
        "float32": "number",

        "Vector3": "Vector",
    };

    private static typeHandlers: {
        Name: string,
        Check: ( dataTypeString: string ) => boolean|undefined,
        Handler:( dataTypeString: string ) => LuaDataType
    }[] = [
        {
            Name: "DynamicVectorClass",
            Check: function( dataTypeString: string ): boolean|undefined {
                if( dataTypeString.startsWith( "DynamicVectorClass" ) ){
                    return true;
                }
            },
            Handler: function( dataTypeString: string ): LuaDataType {
                const leftBracketIndex  = dataTypeString.indexOf( "<" );
                const rightBracketIndex = dataTypeString.indexOf( ">" );

                var subTypeString = dataTypeString.substring( leftBracketIndex + 1, rightBracketIndex - 1 ).trim();

                // Dynamic Vectors are basically just arrays
                return new LuaDataType( subTypeString, 1 );
            }
        },
        {
            Name: "Integers",
            Check: function( dataTypeString: string ): boolean|undefined {
                return /^_*(?:u?int|unsigned)[0-9]*(?:\[.+\])*$/m.test( dataTypeString );
            },
            Handler: function( dataTypeString: string ): LuaDataType {
                const arrayDepth = CppToLuaTypeConverter.getArrayDepth( dataTypeString );

                return new LuaDataType( "integer", arrayDepth );
            }
        },
        {
            Name: "Floats/Doubles",
            Check: function( dataTypeString: string ): boolean|undefined {
                return /^(?:(?:f|F)loat|(?:d|D)ouble)[0-9]*$/m.test( dataTypeString );
            },
            Handler: function( dataTypeString: string ): LuaDataType {
                const arrayDepth = CppToLuaTypeConverter.getArrayDepth( dataTypeString );

                return new LuaDataType( "number", arrayDepth );
            }
        }
    ];

    /** 
     * @return `0` if the data type is not an array, `1` if the data type is an array, `2` if it's a 2D array, etc.
     */
    private static getArrayDepth( dataTypeString: string ): number {
        return ( dataTypeString.length - dataTypeString.replaceAll( "[", "" ).length );
    }

    private static getTypeHandler( dataTypeString: string ): ( ( dataTypeString: string ) => LuaDataType )|undefined {
        for (let handlerIndex = 0; handlerIndex < this.typeHandlers.length; handlerIndex++) {
            const entry = this.typeHandlers[handlerIndex];
            if( entry.Check( dataTypeString ) ){
                return entry.Handler;
            }
        }
    }

    public static getLuaDataType( cppDataType: string ): LuaDataType {
        // Use a dedicated type handler if one exists
        let handler = this.getTypeHandler( cppDataType );
        if( handler !== undefined ){
            const convertedDataType = handler( cppDataType );
            return convertedDataType;
        }

        // Otherwise, use less complicated conversions

        let luaDataTypeName: string|undefined = undefined;
        let arrayDepth = 0;

        // Use a simple type conversion if one is defined
        const hasSimpleConversion = this.simpleTypeNameConversions[cppDataType] !== undefined;
        if( hasSimpleConversion ){
            luaDataTypeName = this.simpleTypeNameConversions[cppDataType];
        }
        
        let expandedDataTypeName = TextUtils.cppNameToLua( cppDataType );

        // Try to find this class name in the Lua cache so we can use the class's Instance name
        if( luaDataTypeName === undefined ){
            const luaClass = LuaImportableCache.getLuaClassByName( expandedDataTypeName );
            if( luaClass !== undefined ){
                luaDataTypeName = luaClass.getInstanceName();
            }
        }

        // Check the enum cache
        if( luaDataTypeName === undefined ){
            const luaEnums = LuaImportableCache.findLuaEnumsByName( expandedDataTypeName );
            if( luaEnums.length > 1 ){
                console.warn( `Found multiple Lua enums with the name '${expandedDataTypeName}' which seems wrong` );
            }

            if( luaEnums.length === 1 ){
                luaDataTypeName = luaEnums[0].getStaticName();
            }
        }

        // Fallback to a best-guess
        if( luaDataTypeName === undefined ){
            luaDataTypeName = expandedDataTypeName;

            console.log( `Fallback data type handling for C++ type '${cppDataType}', best guess is '${expandedDataTypeName}'` );

        }

        return new LuaDataType( luaDataTypeName, arrayDepth );
    }
}