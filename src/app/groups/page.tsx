import { redirect } from "next/navigation";

// groups now live as filter chips on the Library home
export default function GroupsRedirect() {
  redirect("/");
}
