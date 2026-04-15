import * as vscode from 'vscode';

export class TextUtils {

    private static camelCaseWordPattern = /~|[0-9]+(?:[a-z]|[A-Z])*|[A-Z][a-z]+|[A-Z]+(?![a-z])/g;

    private static cppShorthandExpander: Record<string, string> = {
        "Obj"  : "Object",
        "Def"  : "Definition",
        "Anim" : "Animation",
        "Mgr"  : "Manager",
        "Phys" : "Physics",
        "Sys"  : "System",
    };

    /**
     * Replaces any shorthand words with their full and expanded counterparts
     */
    public static expandWords( words: string[] ) : string[] {
        const expandedWords = [];
        for( let wordIndex = 0; wordIndex < words.length; wordIndex++ ){
            const originalWord = words[wordIndex];
            const expandedWord = this.cppShorthandExpander[originalWord];
            expandedWords.push( expandedWord !== undefined ? expandedWord : originalWord );
        }
        return expandedWords;
    }

    /** Converts a C++ identifier (class, function, field) to the format expected by Lua */
    public static cppNameToLua( cppName: string ): string{
        const expandedWords: string[] = [];

        // C++ names are a weird mix of underscore delimited and CamelCase
        // so they must be split multiple times in different ways
        const underscoreSplit = cppName.split( "_" );
        for (let underscoreIndex = 0; underscoreIndex < underscoreSplit.length; underscoreIndex++) {
            const underscoreWord = underscoreSplit[underscoreIndex];
            
            // Underscore-separated words can be:
            // * One ALLCAPS acronym
            // * One Capitalized word
            // * Several CamelCase words

            // Also catches if it's all numbers, probably
            const isAllCaps = underscoreWord === underscoreWord.toUpperCase();

            if( isAllCaps ){
                expandedWords.push( underscoreWord );
            }else{
                const camelCaseSplit = TextUtils.splitCamelCase( underscoreWord );

                const expandedCamelCaseWords = this.expandWords( camelCaseSplit );

                for( let camelCaseIndex = 0; camelCaseIndex < expandedCamelCaseWords.length; camelCaseIndex++ ){
                    const expandedWord = expandedCamelCaseWords[camelCaseIndex];
                    expandedWords.push( expandedWord );
                }
            }
        }

        // Correct capitalization
        // We don't want consecutive capital letters for acronyms like "HUD"
        // Instead, we want to capitalize them as words like "Hud"
        const capitalizedWords: string[] = [];
        for( let wordIndex = 0; wordIndex < expandedWords.length; wordIndex++ ){
            const word = expandedWords[wordIndex];
            const capitalizedWord = TextUtils.capitalize( word.toLowerCase() );
            capitalizedWords.push( capitalizedWord );
        }

        return capitalizedWords.join( "" );
    }

    public static enumToString<T extends object>(enumObj: T, value: number): string | undefined {
        return Object.entries(enumObj)
            .find(([key, val]) => val === value)?.[0];
    }

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
     * Converts CamelCase into an array of each word.  E.g. ["Camel","Case"]
     */
    public static splitCamelCase( camelCaseText: string ) : string[] {
        const words = [];
        let matches = this.camelCaseWordPattern.exec( camelCaseText );
        while( matches !== null ){
            words.push( matches[0] );
            matches = this.camelCaseWordPattern.exec( camelCaseText );
        }
        return words;
    }

    /**
     * Converts CamelCase into UNDERSCORE_CASE
     */
    public static camelCaseToUnderscoreCapitals( camelCaseText: string ) : string {
        return this.splitCamelCase( camelCaseText ).join( "_" ).toUpperCase();
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

    /**
     * Removes any generics in the <DataType, DataType, ...> format
     */
    public static removeGenerics( input: string ): string {
        let genericStartIndex = input.indexOf( "<" );
        let genericEndIndex = input.indexOf( ">" );
        let hasGenericStart = genericStartIndex !== -1;
        let hasGenericEnd = genericEndIndex !== -1;

        while( hasGenericStart ){
            if( hasGenericStart !== hasGenericEnd || genericStartIndex > genericEndIndex ){
                throw new Error( `Found malformed generic in '${input}'` );
            }

            const parentsTextStart = input.substring( 0, genericStartIndex );
            const parentsTextEnd = input.substring( genericEndIndex + 1 );

            input = parentsTextStart + parentsTextEnd;

            genericStartIndex = input.indexOf( "<" );
            genericEndIndex = input.indexOf( ">" );
            hasGenericStart = genericStartIndex !== -1;
            hasGenericEnd = genericEndIndex !== -1;
        }

        return input;
    }

    public static contains( haystack: string, needle: string ) : boolean {
        return haystack.indexOf( needle ) !== -1;
    }

    public static containsAny( haystack: string, ...needles: string[] ) : boolean {
        for (let needleIndex = 0; needleIndex < needles.length; needleIndex++) {
            const needle = needles[needleIndex];
            if( TextUtils.contains( haystack, needle ) ){
                return true;
            }
        }
        return false;
    }

    public static containsAll( haystack: string, ...needles: string[] ): boolean {
        for (let needleIndex = 0; needleIndex < needles.length; needleIndex++) {
            const needle = needles[needleIndex];
            if( !TextUtils.contains( haystack, needle ) ){
                return false;
            }
        }
        return true;
    }
}