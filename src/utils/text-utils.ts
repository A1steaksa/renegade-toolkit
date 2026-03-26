import * as vscode from 'vscode';

export class TextUtils {

    private static camelCaseWordPattern = /[A-Z0-9][a-z]+/g;

    public static getIndent( indentCount: number ) : string {
        const editor = vscode.window.activeTextEditor;
        if( editor === undefined ){
            throw new Error( "No active text editor could be found during indent string creation" );
        }

        const indentSize = editor.options.indentSize;
        return " ".repeat( indentSize as number );
    }

    /**
     * Indents each non-empty line of a given content string
     */
    public static indentAll( content: string, indentCount: number = 1 ): string {
        let result = "";

        const indent = this.getIndent( indentCount );

        const lines = content.split( "\n" );
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            // Don't add a newline to the last line
            let lineEnd = "";
            if( lineIndex !== lines.length - 1 ){
                lineEnd = "\n";
            }

            // Don't indent empty lines
            if( line.length === 0 ){
                result += lineEnd;
                continue;
            }

            result += indent + lines[lineIndex] + lineEnd;
        }

        return result;
    }

    /**
     * Converts the fist character of the input text to lowercase
     */
    public static uncapitalize( text: string ) : string {
        return text.substring( 0, 1 ).toLowerCase() + text.substring( 1 );
    }

    /**
     * Converts the first character of the input text to uppercase
     */
    public static capitalize( text: string ) : string {
        return text.substring( 0, 1 ).toUpperCase() + text.substring( 1 );
    }

    /**
     * Converts CamelCase into UNDERSCORE_CASE
     */
    public static camelCaseToUnderscoreCapitals( camelCaseText: string ) : string {
        const words = [];
        let matches = this.camelCaseWordPattern.exec( camelCaseText );
        while( matches !== null ){
            words.push( matches[0].toUpperCase() );
            matches = this.camelCaseWordPattern.exec( camelCaseText );
        }

        return words.join( "_" );
    }

    /**
     * Converts UNDERSCORE_CASE into CamelCase
     */
    public static underscoreCapitalsToCamelCase( underscoreCapitalsText: string ) : string {
        let camelCase = "";

        const words = underscoreCapitalsText.split( "_" );
        words.forEach( word => {
            word = word.toLowerCase();
            word = TextUtils.capitalize( word );
            
            camelCase += word;
        } );
        
        return camelCase;
    }

    /**
     * Removes a set of strings from the end of an input string repeatedly
     * until the input string no longer ends in any of the provided endings
     */
    public static removeEndings( input: string, endings: string[] ): string {
        let result = input;

        let madeChange = true;
        while( madeChange ){
            madeChange = false;
            
            for (let endingIndex = 0; endingIndex < endings.length; endingIndex++) {
                const ending = endings[endingIndex];
                if( result.endsWith( ending ) ){
                    result = result.substring( 0, result.length - ending.length );
                    madeChange = true;
                }
            }
        }

        return result;
    }

    /**
     * Removes a set of strings from the start of an input string repeatedly
     * until the input string no longer starts with any of the provided beginnings
     */
    public static removeBeginnings( input: string, beginnings: string[] ): string {
        let result = input;

        let madeChange = true;
        while( madeChange ){
            madeChange = false;
            
            for (let beginningIndex = 0; beginningIndex < beginnings.length; beginningIndex++) {
                const beginning = beginnings[beginningIndex];
                if( result.startsWith( beginning ) ){
                    result = result.substring( beginning.length );
                    madeChange = true;
                }
            }
        }

        return result;
    }
}