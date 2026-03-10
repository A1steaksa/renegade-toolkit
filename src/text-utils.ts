import * as vscode from 'vscode';

export class TextUtils {

    private static regionStartPatternTemplate = "--+\\s*#region\\s*";
    private static regionEndPattern = /--+\s*#endregion\s/m;
    private static camelCaseWordPattern = /[A-Z0-9][a-z]+/g;

    public static getRegionContents( document: vscode.TextDocument, regionName: string ) : string | undefined {
        const regionRange = this.getRegionContentRange( document, regionName );
        if( regionRange === undefined ){
            return;
        }

        return document.getText( regionRange );
    }

    /** Searches a Lua file's contents for a given region and retrieves a Range containing its contents */
    public static getRegionContentRange( document: vscode.TextDocument, regionName: string ) : vscode.Range | undefined {
        const fileContents = document.getText();

        const regionStartPattern = new RegExp( this.regionStartPatternTemplate + regionName, "m" );
        const regionStartMatch = regionStartPattern.exec( fileContents );
        if( regionStartMatch === null ) {
            vscode.window.showErrorMessage( "Cannot find the start of the '" + regionName + "' region.  Is it missing?" );
            return;
        }
        const regionStartIndex = regionStartMatch.index + regionStartMatch[0].length + 1;

        const textFromRegionStart = fileContents.substring( regionStartIndex );

        const sectionEndMatch = this.regionEndPattern.exec( textFromRegionStart );
        if( sectionEndMatch === null ){
            vscode.window.showErrorMessage( "Cannot find the end of the '" + regionName + "' region.  Is it missing?" );
            return;
        }
        const regionEndIndex = regionStartIndex + sectionEndMatch.index - 1;

        return new vscode.Range(
            document.positionAt( regionStartIndex ),
            document.positionAt( regionEndIndex )
        );
    }

    /** Converts the fist character of the input text to lowercase */
    public static uncapitalize( text: string ) : string {
        return text.substring( 0, 1 ).toLowerCase() + text.substring( 1 );
    }

    /** Converts the first character of the input text to uppercase */
    public static capitalize( text: string ) : string {
        return text.substring( 0, 1 ).toUpperCase() + text.substring( 1 );
    }

    public static camelCaseToUnderscoreCapitals( camelCaseText: string ) : string {
        const words = [];
        let matches = this.camelCaseWordPattern.exec( camelCaseText );
        while( matches !== null ){
            words.push( matches[0].toUpperCase() );
            matches = this.camelCaseWordPattern.exec( camelCaseText );
        }

        return words.join( "_" );
    }

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
}