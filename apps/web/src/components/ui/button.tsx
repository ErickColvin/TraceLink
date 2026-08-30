import { forwardRef, type ButtonHTMLAttributes } from "react";

import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  {
    size?: ButtonSize;
    variant?: ButtonVariant;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, type = "button", variant, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ className, size, variant })}
      {...props}
    />
  ),
);

Button.displayName = "Button";
