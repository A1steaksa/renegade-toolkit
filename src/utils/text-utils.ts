import * as vscode from 'vscode';
import { ErrorUtils } from './error-utils';

export class TextUtils {
    private static cppShorthandExpander: Record<string, string> = {
        "Obj"   : "Object",
        "Objs"  : "Objects",
        "Def"   : "Definition",
        "Anim"  : "Animation",
        "Mgr"   : "Manager",
        "Phys"  : "Physics",
        "Sys"   : "System",
        "Proto" : "Prototype",
        "Alloc" : "Allocate",
        "Prev"  : "Previous",
        "Ptr"   : "Pointer"
    };

    public static isLowerCase( char: string ): boolean {
        const charInt = char.charCodeAt( 0 );
        if( charInt === undefined ){
            return false;
        }
        return (
               charInt >= 97  // a
            && charInt <= 122 // z
        );
    }

    public static isUpperCase( char: string ): boolean {
        const charInt = char.charCodeAt( 0 );
        if( charInt === undefined ){
            return false;
        }
        return (
               charInt >= 65 // A
            && charInt <= 90 // Z
        );
    }

    public static isNumber( char: string ): boolean {
        const charInt = char.charCodeAt( 0 );
        if( charInt === undefined ){
            return false;
        }
        return (
               charInt >= 48 // 0
            && charInt <= 57 // 9
        );
    }

    /**
     * Finds the number of times the needle string occurs in the haystack string
     */
    public static count( haystack: string, needle: string ): number {
        // Remove the needles
        const haystackMinusNeedles = haystack.replaceAll( needle, "" );

        // Figure out how many total characters were removed
        const charCountDifference  = haystack.length - haystackMinusNeedles.length;

        // Figure out how many total needles that number of characters implies
        return charCountDifference / needle.length;
    }

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

    /**
     * Replaces a shorthand word with its full and expanded counterpart
     */
    public static expandWord( word: string ) : string {
        const expandedWord = this.cppShorthandExpander[word];
        return ( expandedWord !== undefined ? expandedWord : word );
    }

    /**
     * Splits a name into a table of words
     */
    public static splitName( cppName: string ): string[] {
        const tokens: string[] = [];
        let currentToken = "";

        for( let charIndex = 0; charIndex < cppName.length; charIndex++ ){
            const previousChar: string = cppName[charIndex - 1] || "";
            const char: string         = cppName[charIndex];
            const nextChar: string     = cppName[charIndex + 1] || "";

            if( this.isNumber( char ) ){

                // A number after a lowercase letter is a new token
                if( this.isLowerCase( previousChar ) ){
                    tokens.push( currentToken );
                    currentToken = char;
                    continue;
                }
                
                currentToken += char;
            }else if( this.isLowerCase( char ) ){
                currentToken += char;
            }else if( this.isUpperCase( char ) ){

                // Check for "2D" and "3D"
                if( char === "D" ){
                    if( previousChar === "2" || previousChar === "3" ){
                        // Make sure this "D" isn't the start of a word like "Definition"
                        if( !this.isLowerCase( nextChar ) ){
                            if( currentToken === "2" || currentToken === "3" ){
                                currentToken += "d";
                                tokens.push( currentToken );
                                currentToken = "";
                                continue;
                            }
                        }
                    }
                }

                // If the next character is lowercase, this is the start of a capitalized word
                if( this.isLowerCase( nextChar ) ){
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = char;
                        continue;
                    }
                }

                // Consecutive uppercase characters get lowercased so they're more clearly a separate "word"
                if( this.isUpperCase( previousChar ) && !this.isLowerCase( nextChar ) ){
                    currentToken += char;
                    continue;
                }

                currentToken += char;
            }else{
                ErrorUtils.error( `Found weird char '${char}' at index ${charIndex} in '${cppName}'` );
            }
        }

        // Push the final token if one is left over
        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        return tokens;
    }

    /**
     * Convert a C++ class name to its equivalent in Lua's naming convention
     */
    public static cppNameToLua( cppName: string ): string{
        // We don't want C++'s "Class" suffixes because we'll be adding our own suffixes later
        cppName = TextUtils.removeEnding( cppName.trim(), "Class" );
        
        let tokens = this.splitName( cppName );

        let luaName = "";
        for( let key in tokens ){
            let word = this.expandWord( tokens[key] );
            luaName += this.capitalize( word.toLowerCase() );
        }

        return luaName;
    }

    /** Converts a C++ identifier (class, function, field) to the format expected by Lua */
    // public static cppNameToLua( cppName: string ): string {
    //     const expandedWords: string[] = [];

    //     // C++ names are a weird mix of underscore delimited and CamelCase
    //     // so they must be split multiple times in different ways
    //     const nameSegments = cppName.split( "_" );
    //     for (let underscoreIndex = 0; underscoreIndex < nameSegments.length; underscoreIndex++) {
    //         const nameSegment = nameSegments[underscoreIndex];
            
    //         // Underscore-separated words can be:
    //         // * One ALLCAPS acronym
    //         // * One Capitalized word
    //         // * Several CamelCase words

    //         // Also catches if it's all numbers, probably
    //         const isAllCaps = nameSegment === nameSegment.toUpperCase();

    //         if( isAllCaps ){
    //             expandedWords.push( nameSegment );
    //         }else{
    //             const camelCaseSplit = TextUtils.splitCamelCase( nameSegment );

    //             if( camelCaseSplit.length !== 0 ){
    //                 const expandedCamelCaseWords = this.expandWords( camelCaseSplit );
    
    //                 for( let camelCaseIndex = 0; camelCaseIndex < expandedCamelCaseWords.length; camelCaseIndex++ ){
    //                     const expandedWord = expandedCamelCaseWords[camelCaseIndex];
    //                     expandedWords.push( expandedWord );
    //                 }
    //             }else{
    //                 // Some name segments might not be CamelCase
    //                 const expandedSegment = this.expandWord( nameSegment );
    //                 expandedWords.push( expandedSegment );
    //             }
    //         }
    //     }

    //     // Correct capitalization
    //     // We don't want consecutive capital letters for acronyms like "HUD"
    //     // Instead, we want to capitalize them as words like "Hud"
    //     const capitalizedWords: string[] = [];
    //     for( let wordIndex = 0; wordIndex < expandedWords.length; wordIndex++ ){
    //         const word = expandedWords[wordIndex];
    //         const capitalizedWord = TextUtils.capitalize( word.toLowerCase() );
    //         capitalizedWords.push( capitalizedWord );
    //     }

    //     return capitalizedWords.join( "" );
    // }

    public static enumToString<T extends object>(enumObj: T, value: number): string | undefined {
        return Object.entries(enumObj)
            .find(([key, val]) => val === value)?.[0];
    }

    public static getIndent( indentCount: number = 1 ) : string {
        return "\t".repeat( indentCount );
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
        const pattern = /~|W+3[Dd]|[0-9]+[A-Z]*|[A-Z]+(?=[A-Z][a-z]|\d)|[A-Z][a-z]*|[a-z]+/g;
        const words: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(camelCaseText)) !== null) {
            words.push(match[0]);
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
            
            for( let endingIndex = 0; endingIndex < endings.length; endingIndex++) {
                const ending = endings[endingIndex];
                if( result.endsWith( ending ) ){
                    result = this.removeEnding( result, ending );
                    madeChange = true;
                }
            }
        }

        return result;
    }

    /**
     * Removes a string from the end of an input string
     */
    public static removeEnding( input: string, ending: string ): string {
        if( input.endsWith( ending ) ){
            return input.substring( 0, input.length - ending.length );
        }

        return input;
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
            
            for( let beginningIndex = 0; beginningIndex < beginnings.length; beginningIndex++ ){
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