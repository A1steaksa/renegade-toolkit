import * as vscode from 'vscode';
import { FileUtils } from '../utils/file-utils';

export class CppLexicalAnalyzer {

    // Whitespace
    private static space    = / /;
    private static tab      = /\t/;
    private static newLine  = /\n/;
    private static whitespace = new RegExp( `(${this.space.source}|${this.tab.source}|${this.newLine.source})` );

    // Numbers
    private static digit = /[0-9]/;
    private static digits = new RegExp( `(${this.digit.source}+)` );

    // Letters
    private static lowerLetter = /[a-z]/;
    private static upperLetter = /[A-Z]/;
    private static letter = new RegExp( `(${this.lowerLetter.source}|${this.upperLetter.source})` );

    private static alphaNum = new RegExp( `(${this.letter.source}|${this.digit.source})` );

    private static identifier = new RegExp( `${this.letter.source}(${this.alphaNum.source}|_)*` );
    
    public static async read( uri: vscode.Uri ){
        const fileString = await FileUtils.read( uri );

        let lineNumber = 0;

        let token = "";

        for( let charIndex = 0; charIndex < fileString.length; charIndex++ ){
            const char = fileString[charIndex];

            if( this.whitespace.test( char ) ){
                if( this.newLine.test( char ) ){
                    lineNumber++;
                }
                continue;
            }

            if( this.letter.test( char ) ){
                let lookAhead = 1;
                let lookAheadChar = fileString[charIndex + lookAhead];

                while( this.alphaNum.test( lookAheadChar ) ){
                    token += lookAheadChar;

                    lookAhead++;
                    lookAheadChar = fileString[charIndex + lookAhead];
                }

                console.log( token );

                charIndex = lookAhead + 1;
                token = "";

                continue;
            }

        }
    }
}

class Reader {

    public constructor( uri: vscode.Uri ){

    }

}