import { redirect } from "next/navigation";

// Stocks is now the default investments view
export default function InvestmentsPage() {
  redirect("/investments/stocks");
}
