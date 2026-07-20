import { ErrorUtils } from "../../utils/error-utils";
import { CppDataType } from "./cpp-data-type";

export enum CppAccessType {
    Public,
    Private,
    Protected
}

export class CppParent {
    public constructor(
        public Access: CppAccessType,
        public DataType: CppDataType,
    ){}

    public static fromString( parentString: string ): CppParent {

        let access:   CppAccessType|undefined;
        let dataType: CppDataType|undefined;

        const tokens: string[] = [];
        let currentToken = "";

        // State tracking
        let genericDepth = 0; // How many '<' have we seen that haven't yet had a matching '>'?

        for( let charIndex = 0; charIndex < parentString.length; charIndex++ ){
            const char = parentString[charIndex];
            
            switch( char ){

                // Whitespace
                case "\t":
                case "\n":
                case " ": {
                    // Generics can contain whitespace
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    // Check if the token is an access specifier
                    switch( currentToken ){
                        case "public": {
                            access = CppAccessType.Public;
                            currentToken = "";
                            break;
                        }
                        case "private": {
                            access = CppAccessType.Private;
                            currentToken = "";
                        }
                        case "protected": {
                            access = CppAccessType.Protected;
                            currentToken = "";
                        }
                    }

                    // By default, spaces are token separators
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                    }

                    break;
                }

                default: {
                    currentToken += char;
                    break;
                }
            }
        }
        // Push the last token if it isn't already
        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        // The last token should be the data type
        dataType = CppDataType.fromString( tokens[tokens.length - 1] );

        if( access === undefined ){
            ErrorUtils.error( `Unable to find access type in '${parentString}'` );
        }

        if( dataType === undefined ){
            ErrorUtils.error( `Unable to find data type in '${parentString}'` );
        }

        return new CppParent( access, dataType );

    }
}