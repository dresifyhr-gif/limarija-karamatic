/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Postavlja middleware na /admin/** i /api/admin/** kad je sesija valjana. */
    admin?: import('@/lib/server/auth').AdminSession;
  }
}
