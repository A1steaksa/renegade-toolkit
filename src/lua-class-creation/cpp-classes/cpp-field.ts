import * as vscode from 'vscode';
import { CppDataType } from "./cpp-data-type";
import { TextUtils } from '../../utils/text-utils';

export class CppField {
    public constructor(
        public IsStatic: boolean,
        public IsMutable: boolean = false,
        public Name: string,
        public DataType: CppDataType,
        public ArrayDepth: number = 0,
    ){}

    public static fromSymbols( headerDocument: vscode.TextDocument, fields: vscode.DocumentSymbol[] ): CppField[] {
        const cppFields: CppField[] = [];

        for( let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++ ){
            const fieldSymbol = fields[fieldIndex];
            const fieldText = headerDocument.getText( fieldSymbol.range );
            cppFields.push( this.fromString( fieldText ) );
        }

        return cppFields;
    }

    public static fromString( declaration: string ): CppField {

        console.log( `Field: '${declaration}'` );

        for( let charIndex = 0; charIndex < declaration.length; charIndex++ ){
            const char = declaration[charIndex];

            

        }

        // "Collapse" whitespace down to a single space
        declaration = declaration.replaceAll( /\s+/g, " " );

        // Remove the semicolon
        declaration = declaration.replaceAll( ";", "" ).trim();

        // Remove the "static" keyword
        const isStatic = declaration.startsWith( "static " );
        declaration = TextUtils.removeBeginnings( declaration, [ "static" ] ).trim();

        // Remove the "mutable" keyword
        const isMutable = declaration.startsWith( "mutable " );
        declaration = TextUtils.removeBeginnings( declaration, [ "mutable" ] ).trim();

        // Remove the field name
        const fieldNameStartIndex = declaration.lastIndexOf( " " ) + 1;
        const fieldName = declaration.substring( fieldNameStartIndex ).trim();
        declaration = declaration.substring( 0, fieldNameStartIndex ).trim();

        // Check for array indicators
        const arrayStartIndex = declaration.indexOf( "[" );
        if( arrayStartIndex !== -1 ){
            const errorString = `Unhandled array syntax in '${declaration}'`;
            console.error( errorString );
            throw Error( errorString );
        }

        // At this point the only thing left in the declaration string should be the data type
        const dataType = CppDataType.fromString( declaration );

        console.log( "" );

        return new CppField( isStatic, isMutable, fieldName, dataType );
    }
}