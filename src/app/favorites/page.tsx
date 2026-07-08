import { redirect } from "next/navigation";

// favorites are the ♥ chip on the Library home
export default function FavoritesRedirect() {
  redirect("/");
}
