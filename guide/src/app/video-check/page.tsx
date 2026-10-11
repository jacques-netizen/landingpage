// Playback check for a specific phone. Not linked. Open it on the device,
// tap Start, and read or screenshot what it says.
import { VideoCheck } from "./VideoCheck";

export const metadata = { title: "Video check", robots: { index: false, follow: false } };

export default function Page() {
  return <VideoCheck />;
}
