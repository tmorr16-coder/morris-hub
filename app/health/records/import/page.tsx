import { LargeTitle } from "@/components/ios";
import ImportClient from "./_components/ImportClient";

export default function ImportRecordPage() {
  return (
    <div className="ios-scroll">
      <LargeTitle title="Add Record" subtitle="Upload a report or enter results by hand" />
      <ImportClient />
    </div>
  );
}
