import React, {
    useCallback,
    useEffect,
    useState,
    useRef,
    FunctionComponent,
    useMemo,
    isValidElement,
} from 'react';
import Downshift, { DownshiftProps } from 'downshift';
import classNames from 'classnames';
import get from 'lodash/get';
import { makeStyles, TextField } from '@material-ui/core';
import { TextFieldProps } from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import ClearIcon from '@material-ui/icons/Clear';

import {
    useInput,
    FieldTitle,
    InputProps,
    useSuggestions,
    warning,
    useTranslate,
} from 'ra-core';

import InputHelperText from './InputHelperText';
import AutocompleteSuggestionList from './AutocompleteSuggestionList';
import AutocompleteSuggestionItem from './AutocompleteSuggestionItem';

interface Options {
    suggestionsContainerProps?: any;
    labelProps?: any;
}

/**
 * An Input component for an autocomplete field, using an array of objects for the options
 *
 * Pass possible options as an array of objects in the 'choices' attribute.
 *
 * By default, the options are built from:
 *  - the 'id' property as the option value,
 *  - the 'name' property an the option text
 * @example
 * const choices = [
 *    { id: 'M', name: 'Male' },
 *    { id: 'F', name: 'Female' },
 * ];
 * <AutocompleteInput source="gender" choices={choices} />
 *
 * You can also customize the properties to use for the option name and value,
 * thanks to the 'optionText' and 'optionValue' attributes.
 * @example
 * const choices = [
 *    { _id: 123, full_name: 'Leo Tolstoi', sex: 'M' },
 *    { _id: 456, full_name: 'Jane Austen', sex: 'F' },
 * ];
 * <AutocompleteInput source="author_id" choices={choices} optionText="full_name" optionValue="_id" />
 *
 * `optionText` also accepts a function, so you can shape the option text at will:
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const optionRenderer = choice => `${choice.first_name} ${choice.last_name}`;
 * <AutocompleteInput source="author_id" choices={choices} optionText={optionRenderer} />
 *
 * `optionText` also accepts a React Element, that will be cloned and receive
 * the related choice as the `record` prop. You can use Field components there.
 * Note that you must also specify the `matchSuggestion` prop
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const matchSuggestion = (filterValue, choice) => choice.first_name.match(filterValue) || choice.last_name.match(filterValue);
 * const FullNameField = ({ record }) => <span>{record.first_name} {record.last_name}</span>;
 * <SelectInput source="gender" choices={choices} optionText={<FullNameField />} matchSuggestion={matchSuggestion} />
 *
 * The choices are translated by default, so you can use translation identifiers as choices:
 * @example
 * const choices = [
 *    { id: 'M', name: 'myroot.gender.male' },
 *    { id: 'F', name: 'myroot.gender.female' },
 * ];
 *
 * However, in some cases (e.g. inside a `<ReferenceInput>`), you may not want
 * the choice to be translated. In that case, set the `translateChoice` prop to false.
 * @example
 * <AutocompleteInput source="gender" choices={choices} translateChoice={false}/>
 *
 * The object passed as `options` props is passed to the material-ui <AutoComplete> component
 *
 * @example
 * <AutocompleteInput source="author_id" options={{ fullWidthInput: true }} />
 */
const AutocompleteInput: FunctionComponent<
    InputProps<TextFieldProps & Options> & DownshiftProps<any>
> = ({
    resettable,
    classes: classesOverride,
    clearAlwaysVisible = true,
    choices = [],
    emptyValue,
    format,
    helperText,
    id: idOverride,
    input: inputOverride,
    isRequired: isRequiredOverride,
    label,
    limitChoicesToValue,
    margin = 'dense',
    matchSuggestion,
    meta: metaOverride,
    onBlur,
    onChange,
    onFocus,
    options: {
        suggestionsContainerProps,
        labelProps,
        InputProps,
        ...options
    } = {},
    optionText = 'name',
    optionValue = 'id',
    parse,
    resource,
    setFilter,
    shouldRenderSuggestions: shouldRenderSuggestionsOverride,
    source,
    suggestionLimit,
    translateChoice = true,
    validate,
    variant = 'filled',
    ...rest
}) => {
    warning(
        isValidElement(optionText) && !matchSuggestion,
        `If the optionText prop is a React element, you must also specify the matchSuggestion prop:
<AutocompleteInput
    matchSuggestion={(filterValue, suggestion) => true}
/>
        `
    );

    const classes = useStyles({ classes: classesOverride });
    const translate = useTranslate();

    const [showClear, setShowClear] = useState(false);
    const [hasFocus, setHasFocus] = React.useState(false);

    let inputEl = useRef<HTMLInputElement>();
    let anchorEl = useRef<any>();

    const {
        id,
        input,
        isRequired,
        meta: { touched, error },
    } = useInput({
        format,
        id: idOverride,
        input: inputOverride,
        isRequired: isRequiredOverride,
        meta: metaOverride,
        onBlur,
        onChange,
        onFocus,
        parse,
        resource,
        source,
        validate,
        ...rest,
    });

    const [filterValue, setFilterValue] = React.useState('');

    const getSuggestionFromValue = useCallback(
        value => choices.find(choice => get(choice, optionValue) === value),
        [choices, optionValue]
    );

    const [selectedItem, setSelectedItem] = React.useState(null);

    useEffect(() => {
        // if there are choices available (they may be arrive later)
        if (choices && choices.length > 0 && input.value) {
            setSelectedItem(getSuggestionFromValue(input.value) || null);
        } else {
            // no selected item as there are no choices yet
            setSelectedItem(null);
        }
    }, [choices, getSuggestionFromValue, input.value]);

    const { getChoiceText, getChoiceValue, getSuggestions } = useSuggestions({
        choices,
        emptyValue,
        limitChoicesToValue,
        matchSuggestion,
        optionText,
        optionValue,
        selectedItem,
        suggestionLimit,
        translateChoice,
    });

    const handleFilterChange = useCallback(
        (eventOrValue: React.ChangeEvent<{ value: string }> | string) => {
            const event = eventOrValue as React.ChangeEvent<{ value: string }>;
            const value = event.target
                ? event.target.value
                : (eventOrValue as string);

            if (setFilter) {
                setFilter(value);
            }
        },
        [setFilter]
    );

    // We must reset the filter every time the value changes to ensure we
    // display at least some choices even if the input has a value.
    // Otherwise, it would only display the currently selected one and the user
    // would have to first clear the input before seeing any other choices
    useEffect(() => {
        handleFilterChange('');

        // If we have a value, set the filter to its text so that
        // Downshift displays it correctly.
        // Assure that we have a selected item to succeed.
        setFilterValue(
            input.value ? (selectedItem ? getChoiceText(selectedItem) : '') : ''
        );
    }, [input.value, handleFilterChange, selectedItem, getChoiceText]);

    const handleClickClearButton = useCallback(
        event => {
            event.preventDefault();
            input.onChange('');
        },
        [input]
    );

    const handleMouseDownClearButton = event => {
        event.preventDefault();
    };

    const handleChange = useCallback(
        (item: any) => {
            input.onChange(getChoiceValue(item));
        },
        [getChoiceValue, input]
    );

    // This function ensures that the suggestion list stay aligned to the
    // input element even if it moves (because user scrolled for example)
    const updateAnchorEl = () => {
        if (!inputEl.current) {
            return;
        }

        const inputPosition = inputEl.current.getBoundingClientRect() as DOMRect;

        // It works by implementing a mock element providing the only method used
        // by the PopOver component, getBoundingClientRect, which will return a
        // position based on the input position
        if (!anchorEl.current) {
            anchorEl.current = { getBoundingClientRect: () => inputPosition };
        } else {
            const anchorPosition = anchorEl.current.getBoundingClientRect();

            if (
                anchorPosition.x !== inputPosition.x ||
                anchorPosition.y !== inputPosition.y
            ) {
                anchorEl.current = {
                    getBoundingClientRect: () => inputPosition,
                };
            }
        }
    };

    const storeInputRef = input => {
        inputEl.current = input;
        updateAnchorEl();
    };

    const handleBlur = useCallback(
        event => {
            handleFilterChange('');
            // If we had a value before, set the filter back to its text so that
            // Downshift displays it correctly
            setFilterValue(input.value ? getChoiceText(selectedItem) : '');
            setHasFocus(false);
            setShowClear(false);
            input.onBlur(event);
        },
        [getChoiceText, handleFilterChange, input, selectedItem]
    );

    const shouldRenderSuggestions = useCallback(
        val => {
            if (
                shouldRenderSuggestionsOverride !== undefined &&
                typeof shouldRenderSuggestionsOverride === 'function'
            ) {
                return shouldRenderSuggestionsOverride(val);
            }

            if (rest.disabled) return false;

            return true;
        },
        [rest.disabled, shouldRenderSuggestionsOverride]
    );

    const handleFocus = useCallback(
        openMenu => event => {
            input.onFocus(event);
            setHasFocus(true);
            setShowClear(true);
        },
        [input]
    );

    return (
        <Downshift
            inputValue={filterValue}
            onChange={handleChange}
            selectedItem={selectedItem}
            itemToString={item => getChoiceValue(item)}
            {...rest}
        >
            {({
                getInputProps,
                getItemProps,
                getLabelProps,
                getMenuProps,
                isOpen,
                inputValue,
                highlightedIndex,
                openMenu,
                closeMenu,
                clearSelection,
            }) => {
                const isMenuOpen =
                    isOpen && shouldRenderSuggestions(filterValue);
                const {
                    id: downshiftId, // We want to ignore this to correctly link our label and the input
                    value,
                    onBlur,
                    onChange,
                    onFocus,
                    ref,
                    ...inputProps
                } = getInputProps({
                    onBlur: handleBlur,
                    onFocus: handleFocus(openMenu),
                    disabled: rest.disabled,
                });
                const suggestions = getSuggestions(filterValue);

                return (
                    <div className={classes.container}>
                        <TextField
                            id={id}
                            name={input.name}
                            InputProps={{
                                inputRef: storeInputRef,
                                classes: {
                                    root: classNames(classes.inputRoot, {
                                        [classes.inputRootFilled]:
                                            variant === 'filled',
                                    }),
                                    input: classes.inputInput,
                                },
                                onBlur,
                                onChange: event => {
                                    handleFilterChange(event);
                                    setFilterValue(event.target.value);
                                    onChange!(event as React.ChangeEvent<
                                        HTMLInputElement
                                    >);
                                    if (event.target.value === '') {
                                        clearSelection();
                                    }
                                },
                                onFocus,
                                onClick: event => {
                                    if (
                                        !isMenuOpen &&
                                        rest.disabled !== true &&
                                        shouldRenderSuggestions(filterValue) &&
                                        hasFocus
                                    ) {
                                        openMenu();
                                    }
                                },
                                endAdornment: resettable && value && (
                                    <InputAdornment
                                        position="end"
                                        classes={{
                                            root: rest.select
                                                ? classes.selectAdornment
                                                : null,
                                        }}
                                    >
                                        <IconButton
                                            className={classNames(
                                                classes.clearButton,
                                                {
                                                    [classes.visibleClearButton]:
                                                        clearAlwaysVisible ||
                                                        showClear,
                                                }
                                            )}
                                            aria-label={translate(
                                                'ra.action.clear_input_value'
                                            )}
                                            title={translate(
                                                'ra.action.clear_input_value'
                                            )}
                                            disableRipple
                                            onClick={event => {
                                                closeMenu();
                                                handleClickClearButton(event);
                                            }}
                                            onMouseDown={
                                                handleMouseDownClearButton
                                            }
                                            disabled={rest.disabled}
                                        >
                                            <ClearIcon
                                                className={classNames(
                                                    classes.clearIcon,
                                                    {
                                                        [classes.visibleClearIcon]:
                                                            clearAlwaysVisible ||
                                                            showClear,
                                                    }
                                                )}
                                            />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            error={!!(touched && error)}
                            label={
                                <FieldTitle
                                    label={label}
                                    {...labelProps}
                                    source={source}
                                    resource={resource}
                                    isRequired={isRequired}
                                />
                            }
                            InputLabelProps={getLabelProps({
                                htmlFor: id,
                            })}
                            helperText={
                                (touched && error) || helperText ? (
                                    <InputHelperText
                                        touched={touched}
                                        error={error}
                                        helperText={helperText}
                                    />
                                ) : null
                            }
                            variant={variant}
                            margin={margin}
                            value={filterValue}
                            {...inputProps}
                            {...options}
                        />
                        <AutocompleteSuggestionList
                            isOpen={isMenuOpen}
                            menuProps={getMenuProps(
                                {},
                                // https://github.com/downshift-js/downshift/issues/235
                                { suppressRefError: true }
                            )}
                            inputEl={inputEl.current}
                            suggestionsContainerProps={
                                suggestionsContainerProps
                            }
                        >
                            {suggestions.map((suggestion, index) => (
                                <AutocompleteSuggestionItem
                                    key={getChoiceValue(suggestion)}
                                    suggestion={suggestion}
                                    index={index}
                                    highlightedIndex={highlightedIndex}
                                    isSelected={
                                        input.value ===
                                        getChoiceValue(suggestion)
                                    }
                                    filterValue={filterValue}
                                    getSuggestionText={getChoiceText}
                                    {...getItemProps({
                                        item: suggestion,
                                        disabled: rest.disabled,
                                    })}
                                />
                            ))}
                        </AutocompleteSuggestionList>
                    </div>
                );
            }}
        </Downshift>
    );
};

const useStyles = makeStyles(theme => {
    const chipBackgroundColor =
        theme.palette.type === 'light'
            ? 'rgba(0, 0, 0, 0.09)'
            : 'rgba(255, 255, 255, 0.09)';

    return {
        root: {
            flexGrow: 1,
            height: 250,
        },
        container: {
            flexGrow: 1,
            position: 'relative',
        },
        paper: {
            position: 'absolute',
            zIndex: 1,
            marginTop: theme.spacing(1),
            left: 0,
            right: 0,
        },
        chip: {
            margin: theme.spacing(0.5, 0.5, 0.5, 0),
        },
        chipContainerFilled: {
            margin: '27px 12px 10px 0',
        },
        inputRoot: {
            flexWrap: 'wrap',
        },
        inputRootFilled: {
            flexWrap: 'wrap',
            '& $chip': {
                backgroundColor: chipBackgroundColor,
            },
        },
        inputInput: {
            width: 'auto',
            flexGrow: 1,
        },
        divider: {
            height: theme.spacing(2),
        },
        // resettable
        clearIcon: {
            height: 16,
            width: 0,
        },
        visibleClearIcon: {
            width: 16,
        },
        clearButton: {
            height: 24,
            padding: 0,
            width: 0,
        },
        visibleClearButton: {
            width: 24,
        },
        selectAdornment: {
            marginRight: 12,
        },
    };
});

export default AutocompleteInput;
