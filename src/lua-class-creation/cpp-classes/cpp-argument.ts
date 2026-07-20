import { ErrorUtils } from "../../utils/error-utils";
import { CppDataType } from "./cpp-data-type";

export class CppArgument {

    public static Void: CppArgument = new CppArgument( false, "void", CppDataType.Void, 0, undefined );

    public constructor(
        public IsConst: boolean = false,
        public Name: string,
        public DataType: CppDataType,
        public ArrayDepth: number = 0,
        public Default: string|undefined,
    ){}

    /**
     * @param argString 
     * @return Either an argument or undefined if the argument was void
     */
    public static fromString( argString: string ): CppArgument|undefined {
        // Handle void early
        if( argString === "void" ){
            return;
        }

        argString = argString.trim();
        
        let isConst = false;
        let argName: string|undefined;
        let dataType: CppDataType|undefined;
        let arrayDepth: number|undefined;
        let defaultValue: string|undefined;

        let tokens: string[] = [];
        let currentToken = "";

        // State tracking
        let genericDepth = 0; // How many '<' have we seen that haven't yet had a matching '>'?
        let inString = false; // Have we seen a '"' but haven't yet seen a second '"'?
        let inArray = false; // Have we seen a '[' but haven't yet seen a ']'?
        let hasDefault = false;

        for( let charIndex = 0; charIndex < argString.length; charIndex++ ){
            const char = argString[charIndex];

            switch( char ){
                
                case " ": {
                    // Strings can contain ' '
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    // Spaces in generics are just part of their token
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    if( currentToken === "const" ){
                        isConst = true;
                        currentToken = "";
                        break;
                    }

                    // By default spaces are token separators
                    currentToken = currentToken.trim();
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                        break;
                    }

                    break;
                }

                case "\"": {

                    if( inString ){
                        inString = false;

                        tokens.push( currentToken );
                        currentToken = "";
                    }else{
                        inString = true;
                    }

                    break;
                }

                case "<": {
                    // Strings can contain '<'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth++;
                    currentToken += char;
                    break;
                }

                case ">": {
                    // Strings can contain '>'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth--;
                    currentToken += char;
                    break;
                }

                case "[": {
                    // Strings can contain '['
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    inArray = true;

                    if( arrayDepth === undefined ){
                        arrayDepth = 1;
                    }else{
                        arrayDepth++;
                    }

                    // The first array syntax always comes right after the argument name
                    if( arrayDepth === 1 ){
                        currentToken = currentToken.trim();
                        if( currentToken.length === 0 ){
                            argName = tokens[tokens.length - 1];
                            
                            const dataTypeString = tokens[tokens.length - 2];
                            dataType = CppDataType.fromString( dataTypeString );
                        }else{
                            argName = currentToken;
                            currentToken = "";
    
                            const dataTypeString = tokens[tokens.length - 1];
                            dataType = CppDataType.fromString( dataTypeString );
                        }
                    }


                    break;
                }

                case "]": {
                    // Strings can contain ']'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    if( !inArray ){
                        ErrorUtils.unexpectedChar( char, charIndex, argString );
                    }

                    inArray = false;

                    break;
                }

                case "=": {
                    // Strings can contain '='
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    if( hasDefault ){
                        ErrorUtils.unexpectedChar( char, charIndex, argString );
                    }
                    
                    // If there's a token in progress, it's the parameter name
                    currentToken = currentToken.trim();
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                        break;
                    }

                    // Outside of string literals, '=' only appears when defining a default value for an optional argument
                    hasDefault = true;
                    break;
                }

                default: {
                    currentToken += char;
                }
            }
        }

        // The last token won't be on the tokens stack if there wasn't whitespace after it
        currentToken = currentToken.trim();
        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        // If nothing in the declaration already told us the name and data type,
        // we can infer their positions in the token stack
        if( argName === undefined && dataType === undefined ){
            if( hasDefault ){
                defaultValue = tokens[tokens.length - 1];
                argName = tokens[tokens.length - 2];
    
                const dataTypeString = tokens[tokens.length - 3];
                dataType = CppDataType.fromString( dataTypeString );
    
            }else{

                // Arguments might not have names when they're required by an interface but aren't actually used
                if( tokens.length === 1 ){
                    // Pretend this argument doesn't exist
                    return undefined;
                }
                
                argName = tokens[tokens.length - 1];
                const dataTypeString = tokens[tokens.length - 2];
                dataType = CppDataType.fromString( dataTypeString );
            }
        }


        if( argName === undefined ){
            ErrorUtils.error( `Unable to determine argument name from '${argString}'` );
        }

        if( dataType === undefined ){
            ErrorUtils.error( `Unable to determine argument data type from '${argString}'` );
        }

        return new CppArgument( isConst, argName, dataType, arrayDepth, defaultValue );
    }

}