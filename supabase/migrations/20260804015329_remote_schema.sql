


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."sih_disease" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "filter_kind" "text" NOT NULL,
    "tabnet_code" "text" NOT NULL,
    "def_path" "text" DEFAULT 'sih/cnv/nibr.def'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sih_disease_filter_kind_check" CHECK (("filter_kind" = ANY (ARRAY['lista_morb'::"text", 'procedimento'::"text"])))
);


ALTER TABLE "public"."sih_disease" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sih_metric_muni" (
    "disease_id" "text" NOT NULL,
    "municipio_codigo" character(6) NOT NULL,
    "municipio_nome" "text",
    "uf_codigo" character(2) NOT NULL,
    "ano" integer NOT NULL,
    "internacoes" numeric,
    "obitos" numeric,
    "valor_total" numeric,
    "dias_permanencia" numeric,
    "taxa_mortalidade" numeric,
    CONSTRAINT "sih_metric_muni_ano_check" CHECK ((("ano" >= 1990) AND ("ano" <= 2100)))
);


ALTER TABLE "public"."sih_metric_muni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sih_metric_uf" (
    "disease_id" "text" NOT NULL,
    "uf_codigo" character(2) NOT NULL,
    "uf" character(2) NOT NULL,
    "uf_nome" "text",
    "ano" integer NOT NULL,
    "internacoes" numeric,
    "obitos" numeric,
    "valor_total" numeric,
    "dias_permanencia" numeric,
    "taxa_mortalidade" numeric,
    CONSTRAINT "sih_metric_uf_ano_check" CHECK ((("ano" >= 1990) AND ("ano" <= 2100)))
);


ALTER TABLE "public"."sih_metric_uf" OWNER TO "postgres";


ALTER TABLE ONLY "public"."sih_disease"
    ADD CONSTRAINT "sih_disease_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sih_metric_muni"
    ADD CONSTRAINT "sih_metric_muni_pkey" PRIMARY KEY ("disease_id", "municipio_codigo", "ano");



ALTER TABLE ONLY "public"."sih_metric_uf"
    ADD CONSTRAINT "sih_metric_uf_pkey" PRIMARY KEY ("disease_id", "uf_codigo", "ano");



CREATE INDEX "sih_metric_muni_disease_uf_ano" ON "public"."sih_metric_muni" USING "btree" ("disease_id", "uf_codigo", "ano");



CREATE INDEX "sih_metric_uf_disease_ano" ON "public"."sih_metric_uf" USING "btree" ("disease_id", "ano");



ALTER TABLE ONLY "public"."sih_metric_muni"
    ADD CONSTRAINT "sih_metric_muni_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "public"."sih_disease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sih_metric_uf"
    ADD CONSTRAINT "sih_metric_uf_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "public"."sih_disease"("id") ON DELETE CASCADE;



ALTER TABLE "public"."sih_disease" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sih_disease_select_anon" ON "public"."sih_disease" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."sih_metric_muni" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sih_metric_muni_select_anon" ON "public"."sih_metric_muni" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."sih_metric_uf" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sih_metric_uf_select_anon" ON "public"."sih_metric_uf" FOR SELECT TO "authenticated", "anon" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."sih_disease" TO "anon";
GRANT ALL ON TABLE "public"."sih_disease" TO "authenticated";
GRANT ALL ON TABLE "public"."sih_disease" TO "service_role";



GRANT ALL ON TABLE "public"."sih_metric_muni" TO "anon";
GRANT ALL ON TABLE "public"."sih_metric_muni" TO "authenticated";
GRANT ALL ON TABLE "public"."sih_metric_muni" TO "service_role";



GRANT ALL ON TABLE "public"."sih_metric_uf" TO "anon";
GRANT ALL ON TABLE "public"."sih_metric_uf" TO "authenticated";
GRANT ALL ON TABLE "public"."sih_metric_uf" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







