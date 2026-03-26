import * as vscode from 'vscode';

export class RegionUtils {

    private static regionStartPatternTemplate = "--+\\s*#region\\s*";
    private static regionEndPattern = /--+\s*#endregion/m;

    public static getRegionContents( document: vscode.TextDocument, regionName: string ) : string | undefined {
        const regionRange = this.getRegionContentRange( document, regionName );
        if( regionRange === undefined ){
            return;
        }

        return document.getText( regionRange );
    }

    /**
     * @param edit A workspace edit to add the change to.  Omit to apply the change immediately.
     * @param document The document to modify
     * @param regionName The title of the region to be modified
     * @param contents The contents of the region which will be wrapped with formatting to fit into the region
     * @returns The edit that was passed in or undefined if no edit was passed
     */
    public static setRegionContents( edit: vscode.WorkspaceEdit | undefined, document: vscode.TextDocument, regionName: string, contents: string ) : vscode.WorkspaceEdit | undefined {
        const range = this.getRegionContentRange( document, regionName );
        if( range === undefined ){
            console.log( `Unable to find range for '${regionName}' within '${document.uri}'` );
            return;
        }

        const contentString = this.createRegionContentString( contents );

        const editWasMissing = edit === undefined;

        if( editWasMissing ){
            edit = new vscode.WorkspaceEdit();
        }

        edit!.replace( document.uri, range, contentString );

        if( editWasMissing ){
            vscode.workspace.applyEdit( edit! );
            return;
        }

        return edit;
    }
    
    /**
     * Searches a Lua file's contents for a given region and retrieves a Range containing its contents
     */
    public static getRegionContentRange( document: vscode.TextDocument, regionName: string ) : vscode.Range | undefined {
        const fileContents = document.getText();

        const regionStartPattern = new RegExp( this.regionStartPatternTemplate + regionName, "m" );
        const regionStartMatch = regionStartPattern.exec( fileContents );
        if( regionStartMatch === null ) {
            vscode.window.showErrorMessage( "Cannot find the start of the '" + regionName + "' region.  Is it missing?" );
            return;
        }
        const regionStartIndex = regionStartMatch.index + regionStartMatch[0].length;

        const textFromRegionStart = fileContents.substring( regionStartIndex );

        const sectionEndMatch = this.regionEndPattern.exec( textFromRegionStart );
        if( sectionEndMatch === null ){
            vscode.window.showErrorMessage( "Cannot find the end of the '" + regionName + "' region.  Is it missing?" );
            return;
        }
        const regionEndIndex = regionStartIndex + sectionEndMatch.index;

        return new vscode.Range(
            document.positionAt( regionStartIndex ),
            document.positionAt( regionEndIndex )
        );
    }

    /** 
     * Wraps a given string with the formatting required to allow it to
     * replace a comment region's contents without formatting problems
     */
    private static createRegionContentString( content: string ): string {
        // The region's range starts immediately after the title of the region and
        // ends immediately before the start of the endregion comment.
        // This newline separates the start and end comments of the region on their own lines.
        let contentString = "\n";
        
        // Leave the region empty if there's nothing to import
        if( content.trim().length === 0 ){
            return contentString;
        }
        
        // When there's content for the region, we leave an empty line between the
        // region start and the contents of the region so that LuaLS doesn't pick up
        // the region start comment as a documentation comment for whatever the first
        // item in the region is.
        contentString += "\n";

        contentString += content;

        // Push the endregion comment to its own line
        if( !contentString.endsWith( "\n" ) ){
            contentString += "\n";
        }
        return contentString;
    }
}