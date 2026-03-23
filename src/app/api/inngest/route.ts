import { serve }           from "inngest/next";
import { inngest }          from "@/inngest/client";
import { scrapeCompanyFn }  from "@/inngest/scrapeCompany";
import { analyzeJDFn }      from "@/inngest/analyzeJD";
import { dailyCronFn }      from "@/inngest/dailyCron";

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [scrapeCompanyFn, analyzeJDFn, dailyCronFn],
});
