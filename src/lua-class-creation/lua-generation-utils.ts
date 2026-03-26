import * as vscode from 'vscode';
import { TextUtils } from '../utils/text-utils';
import { FunctionSection } from './lua-class-definition';

export class LuaGenerationUtils {

    public static createField( name: string, type: string = "any" ): string {
        return `--- @field ${name} ${type}`;
    }

    public static createStaticFunctions( functions: (string|FunctionSection)[] ) : string {
        let results = "";

        const functionCount = functions.length;
        for( let functionIndex = 0; functionIndex < functionCount; functionIndex++ ){
            const entry = functions[functionIndex];

            // Each function can be a standalone name or a section containing names
            if( typeof entry === "string" ){
                let funcString = this.createStaticFunction( entry as string );

                results += funcString;

            // Sections are processed recursively
            }else if( entry as FunctionSection ){
                const sectionContent = this.createStaticFunctions( entry.Functions );

                results += "\n" + this.createSection( entry.Title, sectionContent );

            }else{
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }

            if( functionIndex !== functionCount - 1 ){
                results += "\n";
            }
        }

        return results;
    }

    public static createInstanceFunctions( functions: (string|FunctionSection)[] ) : string {
        let results = "";

        const functionCount = functions.length;
        for( let functionIndex = 0; functionIndex < functionCount; functionIndex++ ){
            const entry = functions[functionIndex];

            // Each function can be a standalone name or a section containing names
            if( typeof entry === "string" ){
                let funcString = LuaGenerationUtils.createInstanceFunction( entry as string );

                results += funcString;

            // Sections are processed recursively
            }else if( entry as FunctionSection ){
                const sectionContent = this.createInstanceFunctions( entry.Functions );

                results += "\n" + LuaGenerationUtils.createSection( entry.Title, sectionContent );

            }else{
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }

            if( functionIndex !== functionCount - 1 ){
                results += "\n";
            }
        }

        return results;
    }

    public static createStaticFunction( name: string ) : string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result += `function STATIC.${name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }

    public static createInstanceFunction( name: string ) : string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result +=`function INSTANCE:${name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }

    public static createSection( title: string, contents: string ) : string {
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