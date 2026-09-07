export function CreateAccountLink({
  mode,
  onSwitch,
}: {
  mode: "signin" | "signup";
  onSwitch: (mode: "signin" | "signup") => void;
}) {
  return (
    <p className="mt-[18px] flex justify-center gap-[5px] text-center font-body text-[13px] text-ink-2">
      {mode === "signin" ? (
        <>
          New here?
          <button
            type="button"
            onClick={() => onSwitch("signup")}
            className="font-semibold text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create an account
          </button>
        </>
      ) : (
        <>
          Already have an account?
          <button
            type="button"
            onClick={() => onSwitch("signin")}
            className="font-semibold text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in
          </button>
        </>
      )}
    </p>
  );
}
