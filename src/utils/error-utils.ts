


export class ErrorUtils {
    
    public static unexpectedChar( char: string, charIndex: number, parsedString: string ): never {
        console.error( `Found unexpected '${char}' at char ${charIndex}` );
        console.error( `'${parsedString}'` );
        console.error( " ".repeat( charIndex + 1 ) + "^" );

        throw new Error( `Found unexpected '${char}' at char ${charIndex} in '${parsedString}'` );
    }

    public static error( message: string ): never {
        console.error( message );
        throw new Error( message );
    }
}