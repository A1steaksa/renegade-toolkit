import { ErrorUtils } from "../../utils/error-utils";
import { TextUtils } from "../../utils/text-utils";

export class CppDataType {

    public static Void = new CppDataType( "void" );

    public constructor(
        public Name: string,
        public ArrayDepth: number = 0,
        public Generics: CppDataType[]|undefined = undefined
    ){}

    public static fromString( dataTypeString: string ): CppDataType {

        console.log( `DataType: '${dataTypeString}'` );

        const pointerCount = TextUtils.count( dataTypeString, "*" );
        if( pointerCount > 1 ){
            console.error( "Handling for multi-dimensional pointers hasn't been implemented yet" );
        }

        // Get rid of pointer syntax
        dataTypeString = dataTypeString.replace( "*", "" ).trim();

        // Remove spaces
        dataTypeString = dataTypeString.replace( /\s+/g, "" ).trim();

        // The variables we'll be using to create this data type
        let dataTypeName: string|undefined;
        let arrayDepth = 0;
        let generics: CppDataType[] = [];

        // How many layers of nested generics we're currently at
        let genericDepth = 0;

        let currentGenericStartIndex = -1;

        // Iterate over each character in the string
        for( let charIndex = 0; charIndex < dataTypeString.length; charIndex++ ){
            const char = dataTypeString[charIndex];
            switch( char ){

                // Start of generic
                case "<": {
                    if( genericDepth === 0 ){
                        // This handles the name of types that have generics but not types without generics
                        dataTypeName = dataTypeString.substring( 0, charIndex );

                        currentGenericStartIndex = charIndex;
                    }
                    genericDepth++;
                    break;
                }
                
                // Generic separator
                case ",": {
                    // Ignore commas within nested generics
                    if( genericDepth !== 1 ){ break; }

                    // This handle all top-level generics other than the final one which does not end with a comma
                    const currentGenericString = dataTypeString.substring( currentGenericStartIndex + 1, charIndex );
                    generics.push( CppDataType.fromString( currentGenericString ) );

                    currentGenericStartIndex = charIndex;

                    break;
                }

                // End of generic
                case ">": {
                    genericDepth--;
                    if( genericDepth === 0 ){
                        // This handles the final top-level generic which ends with '>'
                        const currentGenericString = dataTypeString.substring( currentGenericStartIndex + 1, charIndex );
                        generics.push( CppDataType.fromString( currentGenericString ) );
                    }
                    break;
                }

            }
        }

        // If no generics were found in the data type string, the entire string is the data type name
        if( currentGenericStartIndex === -1 ){
            dataTypeName = dataTypeString;
        }

        if( dataTypeName === undefined ){
            const errorString = `Failed to find data type name from '${dataTypeString}'`;
            console.error( errorString );
            throw Error( errorString );
        }

        console.log( `Result: '${dataTypeName}', Generics: ${generics.length}, ArrayDepth: ${arrayDepth}` );

        return new CppDataType( dataTypeName, arrayDepth, generics.length === 0 ? undefined : generics );
    }
}