#!/usr/bin/env python3
"""Regenerate the Prisma typecheck shim FROM prisma/schema.prisma.

Sandbox-only: the real Prisma engine can't be downloaded here (CDN blocked), so
we synthesise just enough types to typecheck. Generated from the schema, so a
model that doesn't exist is still a real error.
"""
import re

schema = open("prisma/schema.prisma").read()
models = re.findall(r"model (\w+) \{", schema)
enums = re.findall(r"enum (\w+) \{", schema)

out = [
    "// AUTO-GENERATED from prisma/schema.prisma — do not edit by hand.",
    "// Run: python3 regen-shim.py   (after EVERY schema change)",
    'declare module "@prisma/client" {',
    "  export namespace Prisma {",
    "    type TransactionClient = any;",
    "    type PrismaClientKnownRequestError = any;",
    "    const PrismaClientKnownRequestError: any;",
    "    type Decimal = any;",
    "    const Decimal: any;",
    "    type InputJsonValue = any;",
    "    type JsonValue = any;",
    "  }",
    "  export const Prisma: any;",
    "  export class PrismaClient {",
    "    $transaction: any; $disconnect: any; $connect: any;",
    "    $queryRaw: any; $executeRaw: any; $on: any; $use: any;",
]
for m in models:
    out.append(f"    {m[0].lower() + m[1:]}: any;")
out += ["    constructor(...args: any[]);", "  }"]
for e in enums:
    out.append(f"  export type {e} = string;")
out.append("}")

open("typecheck-shims/prisma-client.d.ts", "w").write("\n".join(out) + "\n")
print(f"✓ shim: {len(models)} models, {len(enums)} enums")
