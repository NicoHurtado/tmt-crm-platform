import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Force dynamic rendering - authentication must happen at runtime, not build time
export const dynamic = 'force-dynamic';

export { handler as GET, handler as POST };
