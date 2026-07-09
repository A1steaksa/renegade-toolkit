import * as vscode from 'vscode';
import { TextUtils } from '../../utils/text-utils';
import { LuaFunctionSection, LuaField, LuaFunction } from './old_lua-class-definition';

export class LuaGenerationUtils {

    public static createFields( fields: LuaField[] ): string {
        let results = "";

        const fieldCount = fields.length;
        for( let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++ ) {
            const field = fields[fieldIndex];
            results += field.getFieldString();
            if( fieldIndex !== fieldCount - 1 ) {
                results += "\n";
            }
        }

        return results;
    }

    public static createStaticFunctions( functions: ( LuaFunction | LuaFunctionSection )[] ): string {
        let results = "";

        const functionCount = functions.length;
        for( let functionIndex = 0; functionIndex < functionCount; functionIndex++ ) {
            const entry = functions[functionIndex];

            // Each function can be a standalone name or a section containing names
            if( entry instanceof LuaFunction ) {
                const luaFunction = ( entry as LuaFunction );
                let funcString = luaFunction.getStaticString();

                results += funcString;

                // Sections are processed recursively
            } else if( (entry as LuaFunctionSection).Functions !== undefined ) {
                const luaFunctionSection = ( entry as LuaFunctionSection );
                const sectionContent = this.createStaticFunctions( luaFunctionSection.Functions );

                results += "\n" + this.createSection( luaFunctionSection.Title, sectionContent );

            } else {
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }

            if( functionIndex !== functionCount - 1 ) {
                results += "\n";
            }
        }

        return results;
    }

    public static createInstanceFunctions( functions: ( LuaFunction | LuaFunctionSection )[] ): string {
        let results = "";

        const functionCount = functions.length;
        for( let functionIndex = 0; functionIndex < functionCount; functionIndex++ ) {
            const entry = functions[functionIndex];

            // Each function can be a standalone name or a section containing names
            if( entry instanceof LuaFunction ) {
                const luaFunction = ( entry as LuaFunction );

                let funcString = luaFunction.getInstanceString();

                results += funcString;

            } else if( (entry as LuaFunctionSection).Functions !== undefined ) {
                const luaFunctionSection = ( entry as LuaFunctionSection );

                // Sections are processed recursively
                const sectionContent = this.createInstanceFunctions( luaFunctionSection.Functions );

                results += "\n" + this.createSection( luaFunctionSection.Title, sectionContent );

            } else {
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }

            if( functionIndex !== functionCount - 1 ) {
                results += "\n";
            }
        }

        return results;
    }

    public static createStaticFunction( name: string ): string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result += `function STATIC.${name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }

    public static createInstanceFunction( name: string ): string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result += `function INSTANCE:${name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }

    public static createSection( title: string, contents: string ): string {
        let result = "";
        result += `--[[ ${title} ]] do\n\n`;
        result += TextUtils.indentAll( contents, 1 );
        result += `end\n`;
        return result;
    }

    public static createRegion( title: string, contents: string ): string {
        let result = "";
        result += `--#region ${title}\n\n`;
        result += TextUtils.indentAll( contents, 1 );
        result += `--#endregion\n`;
        return result;
    }
}