import * as React from "react"

import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from "@/components/ui/input-group";


export { InputField }
function InputField({ label, value, onChange, onBlur, disabled }: {
    value: string | number;
    label?: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement, Element>) => void;
    disabled?: boolean;
}) {
    return (
        <InputGroup>
            {label && <InputGroupAddon align="inline-start">{label}</InputGroupAddon>}
            <InputGroupInput disabled={disabled} value={value} className="text-sm" onChange={onChange} onBlur={onBlur} />
        </InputGroup>
    )
}
