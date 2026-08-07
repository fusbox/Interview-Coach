import Image from "next/image";

type LabProductCaptureProps = {
    desktopSrc: string;
    mobileSrc: string;
    alt: string;
    desktopHeight?: number;
    mobileHeight?: number;
};

export function LabProductCapture({
    desktopSrc,
    mobileSrc,
    alt,
    desktopHeight = 1000,
    mobileHeight = 844,
}: LabProductCaptureProps) {
    return (
        <figure className="lab-product-capture">
            <div className="lab-product-capture__rim">
                <picture>
                    <source media="(max-width: 959px)" srcSet={mobileSrc} width={390} height={mobileHeight} />
                    <Image
                        src={desktopSrc}
                        alt={alt}
                        width={1440}
                        height={desktopHeight}
                        className="lab-product-capture__image"
                        sizes="(min-width: 960px) 58vw, calc(100vw - 2rem)"
                    />
                </picture>
            </div>
        </figure>
    );
}
