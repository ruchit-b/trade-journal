export interface FormLabelProps {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export function FormLabel({ children, required, htmlFor, className }: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={className ?? 'block text-xs font-medium text-text-secondary mb-1'}
    >
      {children}
      {required && <span className="text-loss ml-0.5">*</span>}
    </label>
  );
}
