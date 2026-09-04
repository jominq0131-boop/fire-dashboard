export type IconName = "mark" | "home" | "calendar" | "wallet" | "lock" | "arrow";
const paths: Record<IconName, string> = {
  mark: "M6 17V7h12M6 12h9M13 17l5-5",
  home: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7",
  calendar:
    "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2",
  wallet: "M4 6h14V3L4 6Zm0 0h16v14H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm11 5h7v5h-7v-5Z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3",
  arrow: "M5 12h14m-5-5 5 5-5 5",
};
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
