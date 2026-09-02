import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Reading is public (anyone with the URL can see the rounds); writing is not.
// The private pages therefore invite a sign-in in place rather than redirecting
// to /login, so a shared link never dead-ends on a login form.
export function SignInEmpty({ description }: { description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LogIn />
        </EmptyMedia>
        <EmptyTitle>Inicia sesión</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/login" />}>Iniciar sesión</Button>
      </EmptyContent>
    </Empty>
  );
}
