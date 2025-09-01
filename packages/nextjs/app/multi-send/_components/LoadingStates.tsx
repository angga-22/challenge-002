import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md", text = "Loading...", className = "" }) => {
  const sizeClasses = {
    sm: "loading-sm",
    md: "loading-md",
    lg: "loading-lg",
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <span className={`loading loading-spinner ${sizeClasses[size]} text-primary`}></span>
      {text && <p className="text-sm opacity-70">{text}</p>}
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", width = "w-full", height = "h-4" }) => {
  return <div className={`skeleton ${width} ${height} ${className}`}></div>;
};

export const FormSkeleton: React.FC = () => {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <Skeleton width="w-48" height="h-6" className="mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 items-center p-4 bg-base-200 rounded-lg">
              <Skeleton width="w-8" height="h-4" />
              <Skeleton width="flex-1" height="h-12" />
              <Skeleton width="w-48" height="h-12" />
              <Skeleton width="w-8" height="h-8" />
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4">
          <Skeleton width="w-32" height="h-10" />
        </div>
        <div className="card-actions justify-end mt-6">
          <Skeleton width="w-40" height="h-12" />
        </div>
      </div>
    </div>
  );
};
