import React from "react";

// https://stackoverflow.com/questions/46240647/react-how-to-force-to-re-render-a-functional-component/53837442#53837442
export default function useRender() {
    const [value, setValue] = React.useState<number>(0);

    // optionally provide a unique number to rerender with for cases
    // where render calls in promise callbacks end up updating the
    // value that already exists
    return () => setValue(Math.random());
}
