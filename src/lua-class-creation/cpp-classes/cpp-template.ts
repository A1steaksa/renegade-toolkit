import { ErrorUtils } from "../../utils/error-utils";
import { CppDataType } from "./cpp-data-type";

export enum CppTemplateType {
    Class,
    TypeName
}

export class CppTemplate {

    public constructor(
        public TemplateType: CppTemplateType|CppDataType,
        public VariableName: string,
    ){}

    public static fromString( templateString: string ): CppTemplate[] {
        
        // We only care about what's between the outermost "<" and ">"
        const startIndex = templateString.indexOf( "<" );
        const endIndex = templateString.lastIndexOf( ">" );
        if( startIndex === -1 || endIndex === -1 ){
            ErrorUtils.error( `Unable to find outer '<' and '<' in '${templateString}'` );
        }
        templateString = templateString.substring( startIndex + 1, endIndex );

        const tokens: string[] = [];
        let currentToken = "";

        // State tracking
        let genericDepth = 0;

        for( let index = 0; index < templateString.length ; index++ ){
            const char = templateString[index];

            switch( char ){

                // Whitespace
                case "\t":
                case "\n":
                case " ": {
                    // Generics can contain spaces
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                        break;
                    }

                    break;
                }

                case ",": {
                    // Generics can contain commas
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    // Commas are token separators
                    tokens.push( currentToken );
                    currentToken = "";

                    break;
                }

                // Generic start
                case "<": {
                    genericDepth++;
                    currentToken += char;
                    break;
                }

                // Generic end
                case ">": {
                    genericDepth--;
                    currentToken += char;
                    break;
                }

                default: {
                    currentToken += char;
                    break;
                }
            }

        }

        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        if( tokens.length % 2 !== 0 ){
            ErrorUtils.error( `Got odd number of template tokens in ${templateString}` );
        }

        const templates: CppTemplate[] = [];

        for( let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 2 ){
            const templateTypeString = tokens[tokenIndex];

            let templateType: CppTemplateType|CppDataType;
            switch( templateTypeString ){
                case "class": {
                    templateType = CppTemplateType.Class;
                    break;
                }

                case "typename": {
                    templateType = CppTemplateType.TypeName;
                    break;
                }

                default: {
                    templateType = CppDataType.fromString( templateTypeString );
                    break;
                }
            }

            const variableName = tokens[tokenIndex + 1];
            

            templates.push( new CppTemplate( templateType, variableName ) );
        }

        return templates;
    }
}